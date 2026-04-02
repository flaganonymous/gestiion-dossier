import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DossierStatut } from '@/lib/supabase/types'
import { sendEmail } from '@/lib/email'

const STATUT_LABELS: Record<string, string> = {
  en_cours: 'En cours',
  finance: 'Financé',
  refuse: 'Refusé',
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'collaborateur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const { statut } = await req.json() as { statut: DossierStatut }
  const statutsValides: DossierStatut[] = ['en_cours', 'refuse', 'finance']
  if (!statutsValides.includes(statut)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  // Récupérer l'ancien statut
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('statut')
    .eq('id', id)
    .single()

  if (!dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

  const ancienStatut = dossier.statut

  // Mettre à jour le statut
  const { error } = await supabase
    .from('dossiers')
    .update({ statut })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enregistrer dans l'historique
  await supabase.from('historique_statuts').insert({
    dossier_id: id,
    ancien_statut: ancienStatut,
    nouveau_statut: statut,
    modifie_par: user.id,
  })

  // Envoyer les notifications email (non-bloquant)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const lienDossier = `${appUrl}/dossiers/${id}`

  ;(async () => {
    try {
      const admin = await createAdminClient()

      // Récupérer le dossier complet avec client et apporteur
      const { data: dossierComplet } = await admin
        .from('dossiers')
        .select('id, titre, client_id, apporteur_id')
        .eq('id', id)
        .single()

      if (!dossierComplet) return

      const emailVariables = {
        titre_dossier: dossierComplet.titre || 'Sans titre',
        ancien_statut: STATUT_LABELS[ancienStatut] || ancienStatut,
        nouveau_statut: STATUT_LABELS[statut] || statut,
        lien_dossier: lienDossier,
      }

      // Notifier le client
      if (dossierComplet.client_id) {
        const { data: clientProfile } = await admin
          .from('profiles')
          .select('email, prenom, nom')
          .eq('id', dossierComplet.client_id)
          .single()

        if (clientProfile?.email) {
          await sendEmail({
            to: clientProfile.email,
            templateSlug: 'statut_change',
            variables: {
              ...emailVariables,
              prenom: clientProfile.prenom || '',
              nom: clientProfile.nom || '',
            },
          })
        }
      }

      // Notifier l'apporteur
      if (dossierComplet.apporteur_id && dossierComplet.apporteur_id !== dossierComplet.client_id) {
        const { data: apporteurProfile } = await admin
          .from('profiles')
          .select('email, prenom, nom')
          .eq('id', dossierComplet.apporteur_id)
          .single()

        if (apporteurProfile?.email) {
          await sendEmail({
            to: apporteurProfile.email,
            templateSlug: 'statut_change',
            variables: {
              ...emailVariables,
              prenom: apporteurProfile.prenom || '',
              nom: apporteurProfile.nom || '',
            },
          })
        }
      }
    } catch (err) {
      console.error('Erreur envoi email notification statut:', err)
    }
  })()

  return NextResponse.json({ ok: true })
}
