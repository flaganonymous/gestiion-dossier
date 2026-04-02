import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = await createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Charger les listes selon le rôle
  let clients: any[] = []
  let apporteurs: any[] = []

  if (['admin', 'collaborateur'].includes(profile.role)) {
    const { data: c } = await admin.from('profiles').select('*').eq('role', 'client').eq('actif', true)
    const { data: a } = await admin.from('profiles').select('*').eq('role', 'apporteur').eq('actif', true)
    clients = c ?? []
    apporteurs = a ?? []
  } else if (profile.role === 'apporteur') {
    const { data: c } = await admin.from('profiles').select('*').eq('role', 'client').eq('actif', true)
    clients = c ?? []
  }

  return NextResponse.json({ profile, clients, apporteurs })
}
