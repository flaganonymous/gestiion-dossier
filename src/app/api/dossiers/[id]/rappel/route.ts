import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { getDocumentsRequis, type SituationLogement, type SituationProfessionnelle } from '@/lib/documents-checklist'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = await createAdminClient()

  // Vérifier les droits (admin/collaborateur uniquement)
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'collaborateur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  // Récupérer le dossier
  const { data: dossier } = await admin
    .from('dossiers')
    .select('id, titre, client_id, situation_logement, situation_professionnelle')
    .eq('id', id)
    .single()

  if (!dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
  if (!dossier.client_id) return NextResponse.json({ error: 'Aucun client associé à ce dossier' }, { status: 400 })

  // Récupérer le profil du client
  const { data: clientProfile } = await admin
    .from('profiles')
    .select('email, prenom, nom')
    .eq('id', dossier.client_id)
    .single()

  if (!clientProfile?.email) {
    return NextResponse.json({ error: 'Email du client introuvable' }, { status: 400 })
  }

  // Calculer les documents manquants
  const sitLog = (dossier.situation_logement ?? 'locataire') as SituationLogement
  const sitPro = (dossier.situation_professionnelle ?? 'salarie') as SituationProfessionnelle
  const documentsRequis = getDocumentsRequis(sitLog, sitPro).filter(d => d.obligatoire)

  // Récupérer les documents déjà uploadés
  const { data: existingDocs } = await admin
    .from('documents')
    .select('categorie_document')
    .eq('dossier_id', id)

  const uploadedCategories = new Set((existingDocs ?? []).map(d => d.categorie_document).filter(Boolean))

  const missingDocs = documentsRequis.filter(d => !uploadedCategories.has(d.id))

  if (missingDocs.length === 0) {
    return NextResponse.json({ error: 'Tous les documents obligatoires sont déjà fournis' }, { status: 400 })
  }

  // Construire la liste HTML des documents manquants
  const listeDocuments = '<ul>' + missingDocs.map(d => `<li>${d.label}</li>`).join('') + '</ul>'

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lienDossier = `${appUrl}/dossiers/${id}`

  // Envoyer l'email de rappel
  const result = await sendEmail({
    to: clientProfile.email,
    templateSlug: 'rappel_documents',
    variables: {
      prenom: clientProfile.prenom || '',
      nom: clientProfile.nom || '',
      titre_dossier: dossier.titre || 'Sans titre',
      liste_documents: listeDocuments,
      lien_dossier: lienDossier,
    },
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Erreur lors de l\'envoi' }, { status: 500 })
  }

  return NextResponse.json({ success: true, email_sent_to: clientProfile.email })
}
