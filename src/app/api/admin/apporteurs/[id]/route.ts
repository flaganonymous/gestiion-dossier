import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 401 }) }

  const admin = await createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 }) }
  }
  return { admin }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, admin } = await assertAdmin()
  if (error) return error
  const { id } = await params

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (typeof body.nom === 'string') update.nom = body.nom.trim()
  if (typeof body.prenom === 'string') update.prenom = body.prenom.trim()
  if (body.email !== undefined) update.email = body.email?.trim() || null
  if (body.telephone !== undefined) update.telephone = body.telephone?.trim() || null
  if (typeof body.actif === 'boolean') update.actif = body.actif

  const { data, error: dbError } = await admin!.from('apporteurs').update(update).eq('id', id).select('*').single()
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, admin } = await assertAdmin()
  if (error) return error
  const { id } = await params

  const { error: dbError } = await admin!.from('apporteurs').delete().eq('id', id)
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
