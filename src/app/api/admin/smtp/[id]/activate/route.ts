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

// Activer cette configuration (désactiver toutes les autres)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  // Désactiver toutes les configurations
  await auth.admin.from('smtp_config').update({ actif: false, updated_at: new Date().toISOString() }).eq('actif', true)

  // Activer celle sélectionnée
  const { error } = await auth.admin.from('smtp_config').update({ actif: true, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
