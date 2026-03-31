import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { UserRole } from '@/lib/supabase/types'

// Créer un utilisateur
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const { email, password, nom, prenom, role } = await req.json()

  if (!email || !password || !nom || !prenom || !role) {
    return NextResponse.json({ error: 'Tous les champs sont requis' }, { status: 400 })
  }

  const adminClient = await createAdminClient()
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    user_metadata: { nom, prenom, role },
    email_confirm: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data.user?.id })
}

// Lister les utilisateurs
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json(users ?? [])
}
