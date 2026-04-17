import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { Apporteur, Profile } from '@/lib/supabase/types'

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

  let clients: Profile[] = []
  let apporteurs: Apporteur[] = []

  if (['admin', 'collaborateur'].includes(profile.role)) {
    const { data: c } = await admin.from('profiles').select('*').eq('role', 'client').eq('actif', true)
    const { data: a } = await admin.from('apporteurs').select('*').eq('actif', true).order('nom')
    clients = c ?? []
    apporteurs = a ?? []
  }

  return NextResponse.json({ profile, clients, apporteurs })
}
