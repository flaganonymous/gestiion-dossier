import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = await createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null

  return { user, admin }
}

// Modifier une configuration SMTP
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.nom !== undefined) updates.nom = body.nom
  if (body.provider !== undefined) updates.provider = body.provider
  if (body.host !== undefined) updates.host = body.host
  if (body.port !== undefined) updates.port = body.port
  if (body.username !== undefined) updates.username = body.username
  // Un mot de passe vide n'est PAS une demande d'effacement : on l'ignore.
  // Pour ne pas ecraser la valeur stockee quand l'utilisateur modifie la
  // config sans retaper le mot de passe.
  if (body.password !== undefined && body.password !== '') {
    updates.password_encrypted = body.password
  }
  if (body.from_email !== undefined) updates.from_email = body.from_email
  if (body.from_name !== undefined) updates.from_name = body.from_name
  if (body.use_tls !== undefined) updates.use_tls = body.use_tls
  updates.updated_at = new Date().toISOString()

  const { error } = await auth.admin.from('smtp_config').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// Supprimer une configuration SMTP
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { error } = await auth.admin.from('smtp_config').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
