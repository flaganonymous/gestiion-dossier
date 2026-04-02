import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildS3Key, getUploadPresignedUrl } from '@/lib/s3'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

  const admin = await createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Acces reserve aux administrateurs' }, { status: 403 })
  }

  const body = await req.json()
  const { mode, dossier: dossierData, dossierId, files } = body as {
    mode: 'new' | 'existing'
    dossier?: {
      titre: string
      client_id?: string
      apporteur_id?: string
      situation_logement?: string
      situation_professionnelle?: string
      emprunt_a_deux?: boolean
      notes?: string
    }
    dossierId?: string
    files: { nomFichier: string; contentType: string; taille?: number; categorieDocument?: string }[]
  }

  let targetDossier: { id: string; annee: number; statut: string; apporteur_id: string | null }

  if (mode === 'new') {
    if (!dossierData?.titre) {
      return NextResponse.json({ error: 'Le titre du dossier est requis' }, { status: 400 })
    }
    const { data: newDossier, error: dossierError } = await admin.from('dossiers').insert({
      titre: dossierData.titre,
      annee: new Date().getFullYear(),
      statut: 'en_cours',
      client_id: dossierData.client_id || null,
      apporteur_id: dossierData.apporteur_id || null,
      notes: dossierData.notes || null,
      situation_logement: dossierData.situation_logement || null,
      situation_professionnelle: dossierData.situation_professionnelle || null,
      emprunt_a_deux: dossierData.emprunt_a_deux || false,
    }).select('id, annee, statut, apporteur_id').single()

    if (dossierError) return NextResponse.json({ error: dossierError.message }, { status: 500 })
    targetDossier = newDossier
  } else {
    if (!dossierId) {
      return NextResponse.json({ error: 'Le dossier cible est requis' }, { status: 400 })
    }
    const { data: existingDossier, error } = await admin.from('dossiers')
      .select('id, annee, statut, apporteur_id')
      .eq('id', dossierId)
      .single()
    if (error || !existingDossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
    targetDossier = existingDossier
  }

  const results = []
  for (const file of files) {
    const s3Key = buildS3Key({
      annee: targetDossier.annee,
      apporteurId: targetDossier.apporteur_id || user.id,
      dossierId: targetDossier.id,
      statut: targetDossier.statut,
      nomFichier: file.nomFichier,
    })

    const uploadUrl = await getUploadPresignedUrl(s3Key, file.contentType)

    const { data: doc, error: docError } = await admin.from('documents').insert({
      dossier_id: targetDossier.id,
      nom_fichier: file.nomFichier,
      type_mime: file.contentType,
      s3_key: s3Key,
      taille: file.taille || null,
      uploade_par: user.id,
      categorie_document: file.categorieDocument || null,
    }).select('id').single()

    results.push({
      nomFichier: file.nomFichier,
      uploadUrl,
      documentId: doc?.id,
      s3Key,
      error: docError?.message,
    })
  }

  return NextResponse.json({
    dossierId: targetDossier.id,
    results,
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorise' }, { status: 401 })

  const admin = await createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Acces reserve aux administrateurs' }, { status: 403 })
  }

  const { data: dossiers } = await admin.from('dossiers')
    .select('id, titre, annee, statut, client:client_id(nom, prenom)')
    .order('updated_at', { ascending: false })
    .limit(100)

  return NextResponse.json(dossiers ?? [])
}
