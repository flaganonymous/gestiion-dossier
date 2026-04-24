import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { token, password } = body as { token?: string; password?: string }

  if (!token || !password) {
    return NextResponse.json(
      { error: 'Token et mot de passe requis' },
      { status: 400 }
    )
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Le mot de passe doit contenir au moins 8 caractères' },
      { status: 400 }
    )
  }

  const admin = await createAdminClient()

  // Validate token
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, prenom, nom, email, invitation_expire_at')
    .eq('invitation_token', token)
    .single()

  if (error || !profile) {
    return NextResponse.json(
      { error: 'Invitation introuvable ou déjà utilisée' },
      { status: 400 }
    )
  }

  // Check expiry
  if (
    profile.invitation_expire_at &&
    new Date(profile.invitation_expire_at) < new Date()
  ) {
    return NextResponse.json(
      { error: 'Cette invitation a expiré. Veuillez contacter votre conseiller.' },
      { status: 400 }
    )
  }

  // Update password on the auth user
  const { error: updateAuthError } = await admin.auth.admin.updateUserById(
    profile.id,
    { password }
  )

  if (updateAuthError) {
    return NextResponse.json({ error: updateAuthError.message }, { status: 500 })
  }

  // Activate profile and clear invitation token
  const { error: updateProfileError } = await admin
    .from('profiles')
    .update({
      actif: true,
      invitation_token: null,
      invitation_expire_at: null,
    })
    .eq('id', profile.id)

  if (updateProfileError) {
    return NextResponse.json({ error: updateProfileError.message }, { status: 500 })
  }

  // Try to send welcome email (non-blocking)
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { sendEmail } = await import('@/lib/email')
    await sendEmail({
      to: profile.email,
      templateSlug: 'bienvenue',
      variables: {
        prenom: profile.prenom,
        nom: profile.nom,
        lien_connexion: `${appUrl}/login`,
      },
    })
  } catch {
    // Email service not configured yet, that's OK
    console.log('Email service not available, skipping welcome email')
  }

  return NextResponse.json({ success: true })
}
