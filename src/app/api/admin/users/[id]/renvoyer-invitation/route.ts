import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

/**
 * POST /api/admin/users/[id]/renvoyer-invitation
 *
 * Régénère un token d'invitation (valable 72h) et renvoie l'email
 * 'invitation_client'. Accessible uniquement aux admins.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = await createAdminClient()
  const { data: me } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const { data: target, error: targetErr } = await admin
    .from('profiles')
    .select('id, email, nom, prenom, role')
    .eq('id', id)
    .single()

  if (targetErr || !target) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }

  if (target.role !== 'client') {
    return NextResponse.json({ error: 'Cette action concerne uniquement les clients' }, { status: 400 })
  }

  if (!target.email) {
    return NextResponse.json({ error: 'Le client n\'a pas d\'email' }, { status: 400 })
  }

  const invitationToken = crypto.randomUUID()
  const expireAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

  const { error: updateErr } = await admin
    .from('profiles')
    .update({
      invitation_token: invitationToken,
      invitation_expire_at: expireAt.toISOString(),
    })
    .eq('id', id)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const invitationUrl = `${appUrl}/invitation/${invitationToken}`

  const { sendEmail } = await import('@/lib/email')
  const result = await sendEmail({
    to: target.email,
    templateSlug: 'invitation_client',
    variables: {
      prenom: target.prenom ?? '',
      nom: target.nom ?? '',
      email: target.email,
      lien_invitation: invitationUrl,
    },
  })

  return NextResponse.json({
    ok: true,
    invitation_url: invitationUrl,
    email_sent: result.success,
    email_error: result.success ? null : (result.error ?? 'Envoi échoué'),
  })
}
