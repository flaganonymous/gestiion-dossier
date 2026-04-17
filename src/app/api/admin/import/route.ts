import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildS3Key, getUploadPresignedUrl } from '@/lib/s3'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = await createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 })
  }

  const body = await req.json()
  const { dossier: dossierData, files } = body as {
    dossier: {
      titre: string
      annee?: number
      statut?: 'en_cours' | 'finance' | 'refuse'
      apporteur_id?: string | null
    }
    files: { nomFichier: string; contentType: string; taille?: number }[]
  }

  if (!dossierData?.titre?.trim()) {
    return NextResponse.json({ error: 'Le nom du dossier est requis' }, { status: 400 })
  }
  if (!files?.length) {
    return NextResponse.json({ error: 'Au moins un fichier est requis' }, { status: 400 })
  }

  const statut = dossierData.statut ?? 'en_cours'
  const annee = dossierData.annee ?? new Date().getFullYear()

  const { data: newDossier, error: dossierError } = await admin.from('dossiers').insert({
    titre: dossierData.titre.trim(),
    annee,
    statut,
    apporteur_id: dossierData.apporteur_id || null,
  }).select('id, annee, statut, apporteur_id').single()

  if (dossierError) return NextResponse.json({ error: dossierError.message }, { status: 500 })

  const results = []
  for (const file of files) {
    const s3Key = buildS3Key({
      annee: newDossier.annee,
      apporteurId: newDossier.apporteur_id || user.id,
      dossierId: newDossier.id,
      statut: newDossier.statut,
      nomFichier: file.nomFichier,
    })

    const uploadUrl = await getUploadPresignedUrl(s3Key, file.contentType)

    const { data: doc, error: docError } = await admin.from('documents').insert({
      dossier_id: newDossier.id,
      nom_fichier: file.nomFichier,
      type_mime: file.contentType,
      s3_key: s3Key,
      taille: file.taille || null,
      uploade_par: user.id,
    }).select('id').single()

    results.push({
      nomFichier: file.nomFichier,
      uploadUrl,
      documentId: doc?.id,
      s3Key,
      error: docError?.message,
    })
  }

  return NextResponse.json({ dossierId: newDossier.id, results })
}
