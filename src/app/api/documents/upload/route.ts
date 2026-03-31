import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildS3Key, getUploadPresignedUrl } from '@/lib/s3'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { dossierId, nomFichier, contentType, taille } = body

  if (!dossierId || !nomFichier || !contentType) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // Vérifier accès au dossier
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('id, annee, statut, apporteur_id')
    .eq('id', dossierId)
    .single()

  if (!dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

  // Récupérer le profil pour vérifier les droits
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const apporteurId = dossier.apporteur_id ?? user.id

  const s3Key = buildS3Key({
    annee: dossier.annee,
    apporteurId,
    dossierId,
    statut: dossier.statut,
    nomFichier,
  })

  // Générer URL pré-signée
  const uploadUrl = await getUploadPresignedUrl(s3Key, contentType)

  // Créer l'entrée en DB
  const { data: doc, error } = await supabase.from('documents').insert({
    dossier_id: dossierId,
    nom_fichier: nomFichier,
    type_mime: contentType,
    s3_key: s3Key,
    taille: taille ?? null,
    uploade_par: user.id,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ uploadUrl, documentId: doc.id, s3Key })
}
