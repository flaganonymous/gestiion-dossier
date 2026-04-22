import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// Activer/désactiver, modifier le rôle, nom, prénom ou email
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const body = await req.json()
  const updates: Record<string, unknown> = {}
  if (body.role !== undefined) updates.role = body.role
  if (body.actif !== undefined) updates.actif = body.actif
  if (body.nom !== undefined) updates.nom = String(body.nom).trim()
  if (body.prenom !== undefined) updates.prenom = String(body.prenom).trim()

  let newEmail: string | undefined
  if (body.email !== undefined) {
    newEmail = String(body.email).trim().toLowerCase()
    if (!newEmail || !newEmail.includes('@')) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    updates.email = newEmail
  }

  // Email change : mettre à jour auth.users avec le service role
  if (newEmail) {
    const adminClient = await createAdminClient()
    const { error: authError } = await adminClient.auth.admin.updateUserById(id, {
      email: newEmail,
      email_confirm: true,
    })
    if (authError) {
      return NextResponse.json({ error: `Auth: ${authError.message}` }, { status: 500 })
    }
  }

  if (Object.keys(updates).length > 0) {
    const admin = await createAdminClient()
    const { error } = await admin.from('profiles').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Supprimer un utilisateur
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const adminClient = await createAdminClient()
  const { error } = await adminClient.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
