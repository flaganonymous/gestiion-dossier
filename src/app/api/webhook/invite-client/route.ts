import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

/**
 * POST /api/webhook/invite-client
 *
 * Webhook endpoint called by the CRM to invite a new client.
 *
 * Required env vars:
 *   - WEBHOOK_SECRET        : shared secret for X-Webhook-Secret header
 *   - NEXT_PUBLIC_APP_URL   : base URL of this app (e.g. https://app.creditunique.fr)
 */
export async function POST(req: NextRequest) {
  // Verify webhook secret
  const secret = req.headers.get('x-webhook-secret')
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { nom, prenom, email, record_id } = body as {
    nom?: string
    prenom?: string
    email?: string
    record_id?: string
  }

  if (!nom || !prenom || !email) {
    return NextResponse.json(
      { error: 'Missing fields: nom, prenom, email required' },
      { status: 400 }
    )
  }

  const admin = await createAdminClient()

  // Check existing user
  const { data: existingProfile } = await admin
    .from('profiles')
    .select('id, email, nom, prenom, actif')
    .eq('email', email)
    .single()

  if (existingProfile) {
    // Update record_id_crm if provided
    if (record_id) {
      await admin
        .from('profiles')
        .update({ record_id_crm: record_id })
        .eq('id', existingProfile.id)
    }
    return NextResponse.json({
      success: true,
      existing: true,
      user_id: existingProfile.id,
      message: 'User already exists',
    })
  }

  // Create auth user with a random password (user will set their own via invitation)
  const tempPassword = crypto.randomUUID()
  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // Generate invitation token and expiry (72 hours)
  const invitationToken = crypto.randomUUID()
  const expireAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

  // Create profile
  const { error: profileError } = await admin.from('profiles').insert({
    id: authUser.user.id,
    email,
    nom,
    prenom,
    role: 'client',
    actif: false,
    record_id_crm: record_id || null,
    invitation_token: invitationToken,
    invitation_expire_at: expireAt.toISOString(),
  })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const invitationUrl = `${appUrl}/invitation/${invitationToken}`

  // Try to send invitation email (non-blocking)
  try {
    const { sendEmail } = await import('@/lib/email')
    await sendEmail({
      to: email,
      templateSlug: 'invitation_client',
      variables: {
        prenom,
        nom,
        email,
        lien_invitation: invitationUrl,
      },
    })
  } catch {
    // Email service not configured yet, that's OK
    console.log('Email service not available, invitation URL returned in response')
  }

  return NextResponse.json({
    success: true,
    existing: false,
    user_id: authUser.user.id,
    invitation_url: invitationUrl,
  })
}
