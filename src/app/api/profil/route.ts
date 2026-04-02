import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json()
  const { nom, prenom } = body

  if (!nom || !prenom) {
    return NextResponse.json({ error: 'Nom et prénom sont requis' }, { status: 400 })
  }

  const admin = await createAdminClient()

  const { data: profile, error } = await admin
    .from('profiles')
    .update({ nom, prenom, updated_at: new Date().toISOString() })
    .eq('id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile })
}
