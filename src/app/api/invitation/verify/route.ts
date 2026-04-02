import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token manquant' }, { status: 400 })
  }

  const admin = await createAdminClient()

  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, prenom, nom, email, invitation_expire_at')
    .eq('invitation_token', token)
    .single()

  if (error || !profile) {
    return NextResponse.json({
      valid: false,
      error: 'Invitation introuvable ou déjà utilisée',
    })
  }

  // Check expiry
  if (
    profile.invitation_expire_at &&
    new Date(profile.invitation_expire_at) < new Date()
  ) {
    return NextResponse.json({
      valid: false,
      error: 'Cette invitation a expiré. Veuillez contacter votre conseiller.',
    })
  }

  return NextResponse.json({
    valid: true,
    prenom: profile.prenom,
    nom: profile.nom,
    email: profile.email,
  })
}
