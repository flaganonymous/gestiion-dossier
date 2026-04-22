import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getS3ObjectBytes } from '@/lib/s3'
import { PDFDocument, PDFImage, StandardFonts, rgb } from 'pdf-lib'
import JSZip from 'jszip'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * GET /api/dossiers/[id]/export-banque
 *
 * Genere 5 PDF groupes par categorie de document (pour envoi banque)
 * et les retourne dans un ZIP. Les 5 groupes suivent le mapping des
 * categories definies dans documents-checklist.ts.
 *
 * - PDFs uploades : fusionnes page par page.
 * - Images JPEG/PNG : integrees comme pages.
 * - Autres types (Word, etc.) : listes mais non inclus dans le PDF.
 */

type GroupeId = 'identite' | 'comptes_bancaires' | 'logement' | 'activite_professionnelle' | 'credits'

const GROUPES: Array<{ id: GroupeId; fileName: string }> = [
  { id: 'identite', fileName: '1-Identite.pdf' },
  { id: 'comptes_bancaires', fileName: '2-Releve-bancaire-et-banque.pdf' },
  { id: 'logement', fileName: '3-Logement.pdf' },
  { id: 'activite_professionnelle', fileName: '4-Revenu.pdf' },
  { id: 'credits', fileName: '5-Prets.pdf' },
]

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = await createAdminClient()
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!me) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Charge le dossier pour construire le nom du ZIP et verifier l'acces
  const { data: dossier, error: dossierErr } = await admin
    .from('dossiers')
    .select('id, titre, client_id, client:client_id(nom, prenom)')
    .eq('id', id)
    .single()

  if (dossierErr || !dossier) {
    return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
  }

  // Access : admin/collaborateur OK, client seulement sur son dossier
  if (!['admin', 'collaborateur'].includes(me.role) && dossier.client_id !== user.id) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // Charge tous les documents du dossier
  const { data: documents, error: docsErr } = await admin
    .from('documents')
    .select('id, nom_fichier, s3_key, type_mime, categorie_document, created_at')
    .eq('dossier_id', id)
    .order('created_at', { ascending: true })

  if (docsErr) {
    return NextResponse.json({ error: docsErr.message }, { status: 500 })
  }

  const zip = new JSZip()
  const skipped: string[] = []

  for (const groupe of GROUPES) {
    const docsGroupe = (documents ?? []).filter(d => d.categorie_document === groupe.id)

    const pdf = await PDFDocument.create()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)

    // Page de garde
    {
      const page = pdf.addPage([595, 842])
      page.drawText(groupe.fileName.replace(/^\d-|\.pdf$/g, '').replace(/-/g, ' '), {
        x: 50, y: 780, size: 22, font: fontBold, color: rgb(0.07, 0.14, 0.22),
      })
      const client = dossier.client as { nom?: string; prenom?: string } | null
      const clientLabel = client ? `${client.prenom ?? ''} ${client.nom ?? ''}`.trim() : ''
      page.drawText(`Dossier : ${dossier.titre}`, { x: 50, y: 745, size: 12, font, color: rgb(0.35, 0.37, 0.42) })
      if (clientLabel) page.drawText(`Client : ${clientLabel}`, { x: 50, y: 728, size: 12, font, color: rgb(0.35, 0.37, 0.42) })
      page.drawText(`Date de genération : ${new Date().toLocaleDateString('fr-FR')}`, { x: 50, y: 711, size: 12, font, color: rgb(0.35, 0.37, 0.42) })
      page.drawText(`${docsGroupe.length} document(s) dans cette section`, { x: 50, y: 694, size: 12, font, color: rgb(0.35, 0.37, 0.42) })
    }

    // Documents du groupe
    for (const doc of docsGroupe) {
      try {
        const bytes = await getS3ObjectBytes(doc.s3_key)
        const mime = (doc.type_mime ?? '').toLowerCase()

        if (mime === 'application/pdf') {
          const srcPdf = await PDFDocument.load(bytes, { ignoreEncryption: true })
          const copied = await pdf.copyPages(srcPdf, srcPdf.getPageIndices())
          copied.forEach(p => pdf.addPage(p))
        } else if (mime === 'image/jpeg' || mime === 'image/jpg') {
          const img = await pdf.embedJpg(bytes)
          addImagePage(pdf, img)
        } else if (mime === 'image/png') {
          const img = await pdf.embedPng(bytes)
          addImagePage(pdf, img)
        } else {
          // Word, etc. : on liste juste sur une page
          const page = pdf.addPage([595, 842])
          page.drawText('Document non integrable', { x: 50, y: 780, size: 14, font: fontBold, color: rgb(0.86, 0.15, 0.15) })
          page.drawText(doc.nom_fichier, { x: 50, y: 755, size: 11, font })
          page.drawText(`Type : ${mime || 'inconnu'}`, { x: 50, y: 740, size: 10, font, color: rgb(0.45, 0.45, 0.45) })
          page.drawText('Ce fichier doit etre converti en PDF ou image avant inclusion.', { x: 50, y: 720, size: 10, font, color: rgb(0.45, 0.45, 0.45) })
          skipped.push(`${groupe.id} / ${doc.nom_fichier}`)
        }
      } catch (err: any) {
        console.error(`Erreur integration doc ${doc.id}:`, err)
        const page = pdf.addPage([595, 842])
        page.drawText('Erreur d\'intégration du document', { x: 50, y: 780, size: 14, font: fontBold, color: rgb(0.86, 0.15, 0.15) })
        page.drawText(doc.nom_fichier, { x: 50, y: 755, size: 11, font })
        page.drawText((err?.message ?? 'Erreur inconnue').slice(0, 100), { x: 50, y: 735, size: 10, font, color: rgb(0.45, 0.45, 0.45) })
      }
    }

    const pdfBytes = await pdf.save()
    zip.file(groupe.fileName, pdfBytes)
  }

  // Note eventuelle des fichiers skippes
  if (skipped.length > 0) {
    zip.file('NOTES.txt', `Fichiers non integres au PDF (a convertir manuellement avant envoi):\n\n${skipped.join('\n')}\n`)
  }

  const zipBytes = await zip.generateAsync({ type: 'uint8array' })

  const client = dossier.client as { nom?: string; prenom?: string } | null
  const safeTitre = (dossier.titre || 'dossier').replace(/[^a-zA-Z0-9._-]/g, '_')
  const suffix = client ? `_${(client.prenom ?? '').replace(/\W/g, '')}_${(client.nom ?? '').replace(/\W/g, '')}` : ''
  const filename = `export-banque_${safeTitre}${suffix}.zip`

  return new NextResponse(new Uint8Array(zipBytes), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function addImagePage(pdf: PDFDocument, img: PDFImage) {
  // A4 portrait en points (595 x 842). On redimensionne l'image pour
  // tenir dans la page en conservant le ratio, avec 30pt de marge.
  const MAX_W = 595 - 60
  const MAX_H = 842 - 60
  const ratio = Math.min(MAX_W / img.width, MAX_H / img.height, 1)
  const w = img.width * ratio
  const h = img.height * ratio
  const page = pdf.addPage([595, 842])
  page.drawImage(img, {
    x: (595 - w) / 2,
    y: (842 - h) / 2,
    width: w,
    height: h,
  })
}
