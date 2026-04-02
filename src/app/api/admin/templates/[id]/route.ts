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

// Modifier un modèle d'email
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
  if (body.sujet !== undefined) updates.sujet = body.sujet
  if (body.corps_html !== undefined) updates.corps_html = body.corps_html
  if (body.corps_texte !== undefined) updates.corps_texte = body.corps_texte
  if (body.variables !== undefined) updates.variables = body.variables
  if (body.actif !== undefined) updates.actif = body.actif
  updates.updated_at = new Date().toISOString()

  const { error } = await auth.admin.from('email_templates').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// Supprimer un modèle d'email
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { error } = await auth.admin.from('email_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
