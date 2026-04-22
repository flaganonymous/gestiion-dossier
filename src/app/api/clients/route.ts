import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

/**
 * POST /api/clients — créer un client (admin ou collaborateur)
 *
 * Même logique que /api/webhook/invite-client mais authentifiée via session.
 * Retourne le profil client (existant ou nouveau) pour permettre la sélection immédiate.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = await createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'collaborateur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const body = await req.json()
  const { nom, prenom, email } = body as { nom?: string; prenom?: string; email?: string }

  if (!nom?.trim() || !prenom?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Nom, prénom et email requis' }, { status: 400 })
  }

  const cleanEmail = email.trim().toLowerCase()

  // Vérifier si le compte existe déjà
  const { data: existing } = await admin
    .from('profiles')
    .select('*')
    .eq('email', cleanEmail)
    .single()

  if (existing) {
    return NextResponse.json({
      client: existing,
      existing: true,
    })
  }

  // Création auth.user + profile + invitation
  const tempPassword = crypto.randomUUID()
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: tempPassword,
    email_confirm: true,
  })

  if (authError || !authUser.user) {
    return NextResponse.json({ error: authError?.message ?? 'Erreur création compte' }, { status: 500 })
  }

  const invitationToken = crypto.randomUUID()
  const expireAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

  // Le trigger handle_new_user crée déjà le profil avec role par défaut.
  // On met à jour les champs complémentaires.
  const { data: updatedProfile, error: updateError } = await admin
    .from('profiles')
    .update({
      nom: nom.trim(),
      prenom: prenom.trim(),
      role: 'client',
      actif: false,
      invitation_token: invitationToken,
      invitation_expire_at: expireAt.toISOString(),
    })
    .eq('id', authUser.user.id)
    .select('*')
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const invitationUrl = `${appUrl}/invitation/${invitationToken}`

  // Envoi email invitation — doit être awaité sinon Lambda (Amplify) tue le
  // handler avant que l'envoi n'ait lieu. On capture l'erreur pour ne pas
  // faire échouer la création du client si SMTP est en panne.
  let emailSent = true
  let emailError: string | null = null
  try {
    const { sendEmail } = await import('@/lib/email')
    const result = await sendEmail({
      to: cleanEmail,
      templateSlug: 'invitation_client',
      variables: {
        prenom: prenom.trim(),
        nom: nom.trim(),
        email: cleanEmail,
        lien_invitation: invitationUrl,
      },
    })
    if (!result.success) {
      emailSent = false
      emailError = result.error ?? 'Envoi échoué'
      console.error('Echec envoi email invitation client:', emailError)
    }
  } catch (err: any) {
    emailSent = false
    emailError = err?.message ?? String(err)
    console.error('Erreur envoi email invitation client:', err)
  }

  return NextResponse.json({
    client: updatedProfile,
    existing: false,
    invitation_url: invitationUrl,
    email_sent: emailSent,
    email_error: emailError,
  })
}
