#!/usr/bin/env node
/**
 * Import en lot d'un arbre de dossiers depuis le disque local.
 *
 * Usage :
 *   node --env-file=.env.local scripts/import-lot.mjs \
 *     --path "/chemin/vers/dossier-racine" \
 *     --annee 2023 \
 *     --statut refuse \
 *     [--apporteur-id UUID] \
 *     [--dry-run]
 *
 * Structure attendue :
 *   dossier-racine/
 *     Martin Jean/         <- devient le titre d'un dossier
 *       cni.pdf
 *       quittance.jpg
 *       ...
 *     Dupont Marie/
 *       ...
 *
 * - Un sous-dossier de niveau 1 = 1 dossier dans l'app.
 * - Tous les fichiers a l'interieur (recursif) sont uploades comme
 *   documents rattaches a ce dossier, sans categorisation.
 * - Les dossiers dont le titre existe deja (meme annee, meme statut)
 *   sont ignores pour eviter les doublons en cas de relance.
 * - En cas d'erreur sur un dossier, les autres continuent.
 *
 * Logs : rapport affiche a la fin, plus un fichier JSON
 * "import-lot-report-<timestamp>.json" dans le cwd.
 */

import { createClient as createSupabase } from '@supabase/supabase-js'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFile, readdir, stat } from 'node:fs/promises'
import { writeFile } from 'node:fs/promises'
import { join, extname, basename } from 'node:path'
import { randomUUID } from 'node:crypto'

// ---------------- Args ----------------
const args = parseArgs(process.argv.slice(2))
if (!args.path) {
  console.error('❌ --path est obligatoire')
  usage()
  process.exit(1)
}
const ANNEE = parseInt(args.annee ?? new Date().getFullYear())
const STATUT = args.statut ?? 'refuse'
const APPORTEUR_ID = args['apporteur-id'] ?? null
const DRY_RUN = 'dry-run' in args

if (!['en_cours', 'refuse', 'finance'].includes(STATUT)) {
  console.error(`❌ --statut doit etre en_cours, refuse ou finance (recu: ${STATUT})`)
  process.exit(1)
}

// ---------------- Env ----------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const S3_REGION = process.env.S3_REGION
const S3_AKI = process.env.S3_ACCESS_KEY_ID
const S3_SECRET = process.env.S3_SECRET_ACCESS_KEY
const S3_BUCKET = process.env.S3_BUCKET_NAME

const missing = []
if (!SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
if (!SUPABASE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
if (!S3_REGION) missing.push('S3_REGION')
if (!S3_AKI) missing.push('S3_ACCESS_KEY_ID')
if (!S3_SECRET) missing.push('S3_SECRET_ACCESS_KEY')
if (!S3_BUCKET) missing.push('S3_BUCKET_NAME')
if (missing.length) {
  console.error(`❌ Variables d'env manquantes : ${missing.join(', ')}`)
  console.error('   Lance avec : node --env-file=.env.local scripts/import-lot.mjs ...')
  process.exit(1)
}

// ---------------- Clients ----------------
const supabase = createSupabase(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
const s3 = new S3Client({
  region: S3_REGION,
  credentials: { accessKeyId: S3_AKI, secretAccessKey: S3_SECRET },
})

// ---------------- Types MIME par extension ----------------
const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
  '.heic': 'image/heic', '.heif': 'image/heif',
}
const ACCEPTED_EXTS = new Set(Object.keys(MIME_BY_EXT))

// ---------------- Main ----------------
const report = {
  startedAt: new Date().toISOString(),
  args: { path: args.path, annee: ANNEE, statut: STATUT, apporteurId: APPORTEUR_ID, dryRun: DRY_RUN },
  dossiers: [],
  skipped: [],
  errors: [],
  summary: null,
}

console.log(`\n📁 Racine : ${args.path}`)
console.log(`📅 Annee : ${ANNEE} | Statut : ${STATUT} | Apporteur : ${APPORTEUR_ID ?? 'aucun'}`)
if (DRY_RUN) console.log('🧪 DRY RUN : rien ne sera cree, juste simule\n')

const rootStat = await stat(args.path).catch(() => null)
if (!rootStat || !rootStat.isDirectory()) {
  console.error(`❌ ${args.path} n'existe pas ou n'est pas un dossier`)
  process.exit(1)
}

// Niveau 1 = un dossier par sous-repertoire
const entries = await readdir(args.path, { withFileTypes: true })
const subfolders = entries.filter(e => e.isDirectory()).map(e => e.name).sort()

console.log(`🔎 ${subfolders.length} sous-dossiers detectes\n`)

let createdCount = 0
let skippedCount = 0
let fileSuccessCount = 0
let fileErrorCount = 0

for (let i = 0; i < subfolders.length; i++) {
  const name = subfolders[i]
  const folderPath = join(args.path, name)
  const label = `[${i + 1}/${subfolders.length}]`
  const titre = name.trim()

  process.stdout.write(`${label} "${titre}" ... `)

  try {
    // Anti-doublon : existe deja avec meme titre + meme annee + meme statut ?
    const { data: existing } = await supabase
      .from('dossiers')
      .select('id')
      .eq('titre', titre)
      .eq('annee', ANNEE)
      .eq('statut', STATUT)
      .limit(1)

    if (existing && existing.length > 0) {
      console.log(`deja existant (${existing[0].id}) → skip`)
      skippedCount++
      report.skipped.push({ titre, reason: 'duplicate', id: existing[0].id })
      continue
    }

    // Lister les fichiers du sous-dossier (recursif, extensions acceptees)
    const files = []
    await walkFiles(folderPath, files)
    const accepted = files.filter(f => ACCEPTED_EXTS.has(extname(f).toLowerCase()))
    const rejected = files.filter(f => !ACCEPTED_EXTS.has(extname(f).toLowerCase()))

    if (DRY_RUN) {
      console.log(`${accepted.length} fichiers (simule)`)
      report.dossiers.push({ titre, filesAccepted: accepted.length, filesRejected: rejected.length, dryRun: true })
      continue
    }

    // Creer le dossier en base
    const dossierId = randomUUID()
    const { error: insertErr } = await supabase.from('dossiers').insert({
      id: dossierId,
      titre,
      annee: ANNEE,
      statut: STATUT,
      client_id: null,
      apporteur_id: APPORTEUR_ID,
    })
    if (insertErr) throw new Error(`insert dossier: ${insertErr.message}`)

    // Uploader chaque fichier + creer la ligne documents
    let dossierFileOk = 0
    let dossierFileKo = 0
    const fileErrors = []

    for (const absPath of accepted) {
      const fileName = basename(absPath)
      const ext = extname(fileName).toLowerCase()
      const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'

      try {
        const buf = await readFile(absPath)
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
        // meme schema de cle que lib/s3.ts buildS3Key
        const s3Key = `${ANNEE}/${APPORTEUR_ID ?? 'no-apporteur'}/${dossierId}/${STATUT}/${safeName}`

        await s3.send(new PutObjectCommand({
          Bucket: S3_BUCKET, Key: s3Key, Body: buf, ContentType: mime,
        }))

        const { error: docErr } = await supabase.from('documents').insert({
          dossier_id: dossierId,
          nom_fichier: fileName,
          type_mime: mime,
          s3_key: s3Key,
          taille: buf.length,
          categorie_document: null,
          uploade_par: null,
        })
        if (docErr) throw new Error(`insert document: ${docErr.message}`)

        dossierFileOk++
      } catch (err) {
        dossierFileKo++
        fileErrors.push({ file: absPath, error: err.message ?? String(err) })
      }
    }

    fileSuccessCount += dossierFileOk
    fileErrorCount += dossierFileKo
    createdCount++

    console.log(`✅ ${dossierFileOk}/${accepted.length} fichiers${rejected.length ? ` (${rejected.length} type(s) ignore(s))` : ''}${dossierFileKo ? ` ⚠ ${dossierFileKo} echec(s)` : ''}`)
    report.dossiers.push({
      id: dossierId, titre,
      filesOk: dossierFileOk, filesKo: dossierFileKo,
      filesRejected: rejected.length,
      errors: fileErrors,
    })
  } catch (err) {
    console.log(`❌ ${err.message}`)
    report.errors.push({ titre, error: err.message })
  }
}

// ---------------- Rapport ----------------
report.summary = {
  total: subfolders.length,
  created: createdCount,
  skipped: skippedCount,
  errors: report.errors.length,
  filesOk: fileSuccessCount,
  filesKo: fileErrorCount,
  endedAt: new Date().toISOString(),
}

console.log('\n' + '─'.repeat(60))
console.log('📊 Rapport')
console.log(`   Dossiers trouves   : ${report.summary.total}`)
console.log(`   Dossiers crees     : ${report.summary.created}`)
console.log(`   Dossiers deja vus  : ${report.summary.skipped}`)
console.log(`   Dossiers en erreur : ${report.summary.errors}`)
console.log(`   Fichiers uploades  : ${report.summary.filesOk}`)
console.log(`   Fichiers echoues   : ${report.summary.filesKo}`)

const reportPath = `import-lot-report-${Date.now()}.json`
await writeFile(reportPath, JSON.stringify(report, null, 2))
console.log(`\n💾 Rapport detaille : ${reportPath}`)

if (report.summary.errors > 0 || report.summary.filesKo > 0) process.exit(2)

// ---------------- Helpers ----------------

async function walkFiles(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      await walkFiles(p, out)
    } else if (e.isFile()) {
      out.push(p)
    }
  }
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (!next || next.startsWith('--')) {
        out[key] = true
      } else {
        out[key] = next
        i++
      }
    }
  }
  return out
}

function usage() {
  console.log(`
Usage :
  node --env-file=.env.local scripts/import-lot.mjs \\
    --path "/chemin/vers/dossier-racine" \\
    [--annee 2023] \\
    [--statut refuse] \\
    [--apporteur-id UUID] \\
    [--dry-run]
`)
}
