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

// Lister toutes les configurations SMTP
export async function GET() {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data, error } = await auth.admin
    .from('smtp_config')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Créer une nouvelle configuration SMTP
export async function POST(req: NextRequest) {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const { nom, provider, host, port, username, password, from_email, from_name, use_tls } = body

  if (!nom || !host || !port || !username || !password || !from_email) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const { data, error } = await auth.admin.from('smtp_config').insert({
    nom,
    provider: provider || 'custom',
    host,
    port,
    username,
    password_encrypted: password,
    from_email,
    from_name: from_name || 'Crédit Unique',
    use_tls: use_tls ?? true,
    actif: false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
