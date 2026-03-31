import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DossierStatut } from '@/lib/supabase/types'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'collaborateur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const { statut } = await req.json() as { statut: DossierStatut }
  const statutsValides: DossierStatut[] = ['en_cours', 'refuse', 'finance']
  if (!statutsValides.includes(statut)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  // Récupérer l'ancien statut
  const { data: dossier } = await supabase
    .from('dossiers')
    .select('statut')
    .eq('id', id)
    .single()

  if (!dossier) return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })

  // Mettre à jour le statut
  const { error } = await supabase
    .from('dossiers')
    .update({ statut })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enregistrer dans l'historique
  await supabase.from('historique_statuts').insert({
    dossier_id: id,
    ancien_statut: dossier.statut,
    nouveau_statut: statut,
    modifie_par: user.id,
  })

  return NextResponse.json({ ok: true })
}
