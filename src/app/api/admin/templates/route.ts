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

// Lister tous les modèles d'email
export async function GET() {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data, error } = await auth.admin
    .from('email_templates')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Créer un nouveau modèle
export async function POST(req: NextRequest) {
  const auth = await checkAdmin()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const { slug, nom, sujet, corps_html, corps_texte, variables } = body

  if (!slug || !nom || !sujet || !corps_html || !corps_texte) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  const { data, error } = await auth.admin.from('email_templates').insert({
    slug,
    nom,
    sujet,
    corps_html,
    corps_texte,
    variables: variables || [],
    actif: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
