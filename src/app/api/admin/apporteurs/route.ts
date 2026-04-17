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

export async function GET() {
  const { error, admin } = await assertAdmin()
  if (error) return error

  const { data, error: dbError } = await admin!.from('apporteurs').select('*').order('nom')
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const { error, admin } = await assertAdmin()
  if (error) return error

  const body = await req.json()
  const { nom, prenom, email, telephone } = body as {
    nom?: string; prenom?: string; email?: string; telephone?: string
  }

  if (!nom?.trim() || !prenom?.trim()) {
    return NextResponse.json({ error: 'Nom et prénom requis' }, { status: 400 })
  }

  const { data, error: dbError } = await admin!.from('apporteurs').insert({
    nom: nom.trim(),
    prenom: prenom.trim(),
    email: email?.trim() || null,
    telephone: telephone?.trim() || null,
  }).select('*').single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json(data)
}
