import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { buildS3Key, getUploadPresignedUrl } from '@/lib/s3'
import { sendEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { dossierId, nomFichier, contentType, taille, categorieDocument } = body

  if (!dossierId || !nomFichier || !contentType) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const admin = await createAdminClient()

  // Vérifier accès au dossier (admin client pour éviter récursion RLS)
  const { data: dossier } = await admin
    .from('dossiers')
    .select('id, annee, statut, apporteur_id, client_id, titre')
    .eq('id', dossierId)
    .single()

  if (!dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

  // Récupérer le profil pour vérifier les droits
  const { data: profile } = await admin
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

  // Créer l'entrée en DB (admin client pour éviter récursion RLS)
  const { data: doc, error } = await admin.from('documents').insert({
    dossier_id: dossierId,
    nom_fichier: nomFichier,
    type_mime: contentType,
    s3_key: s3Key,
    taille: taille ?? null,
    uploade_par: user.id,
    categorie_document: categorieDocument ?? null,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Envoyer les notifications email (non-bloquant)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lienDossier = `${appUrl}/dossiers/${dossierId}`

  ;(async () => {
    try {
      const emailVariables = {
        titre_dossier: dossier.titre || 'Sans titre',
        nom_fichier: nomFichier,
        lien_dossier: lienDossier,
      }

      const isClient = dossier.client_id === user.id

      if (!isClient && dossier.client_id) {
        // L'uploader n'est PAS le client => notifier le client
        const { data: clientProfile } = await admin
          .from('profiles')
          .select('email, prenom, nom')
          .eq('id', dossier.client_id)
          .single()

        if (clientProfile?.email) {
          await sendEmail({
            to: clientProfile.email,
            templateSlug: 'document_ajoute',
            variables: {
              ...emailVariables,
              prenom: clientProfile.prenom || '',
              nom: clientProfile.nom || '',
            },
          })
        }
      } else if (isClient) {
        // L'uploader EST le client => notifier les admin/collaborateurs
        const { data: adminUsers } = await admin
          .from('profiles')
          .select('email, prenom, nom')
          .in('role', ['admin', 'collaborateur'])

        if (adminUsers) {
          for (const adminUser of adminUsers) {
            if (adminUser.email) {
              await sendEmail({
                to: adminUser.email,
                templateSlug: 'document_ajoute',
                variables: {
                  ...emailVariables,
                  prenom: adminUser.prenom || '',
                  nom: adminUser.nom || '',
                },
              })
            }
          }
        }
      }
    } catch (err) {
      console.error('Erreur envoi email notification document:', err)
    }
  })()

  return NextResponse.json({ uploadUrl, documentId: doc.id, s3Key })
}
