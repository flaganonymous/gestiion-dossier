import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = await createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'collaborateur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const statut = searchParams.get('statut')
  const annee = searchParams.get('annee')
  const apporteurId = searchParams.get('apporteur_id')
  const q = searchParams.get('q')

  let query = admin
    .from('dossiers')
    .select(`id, titre, annee, statut, created_at, updated_at, situation_logement, situation_professionnelle, emprunt_a_deux, client:client_id(nom, prenom, email), apporteur:apporteur_id(nom, prenom, email)`)
    .order('titre', { ascending: true })

  if (statut) query = query.eq('statut', statut)
  if (annee) query = query.eq('annee', parseInt(annee))
  if (q) query = query.ilike('titre', `%${q}%`)
  if (apporteurId) {
    if (apporteurId === 'none') query = query.is('apporteur_id', null)
    else query = query.eq('apporteur_id', apporteurId)
  }

  const { data: dossiers = [] } = await query

  // Build CSV
  const BOM = '\uFEFF' // UTF-8 BOM for Excel
  const headers = ['Titre', 'Année', 'Statut', 'Client', 'Email Client', 'Apporteur', 'Logement', 'Profession', 'Emprunt à deux', 'Créé le', 'Mis à jour le']
  const STATUT_MAP: Record<string, string> = { en_cours: 'En cours', finance: 'Financé', refuse: 'Refusé' }

  const rows = (dossiers ?? []).map((d: any) => [
    d.titre,
    d.annee,
    STATUT_MAP[d.statut] ?? d.statut,
    d.client ? `${d.client.prenom} ${d.client.nom}` : '',
    d.client?.email ?? '',
    d.apporteur ? `${d.apporteur.prenom} ${d.apporteur.nom}` : '',
    d.situation_logement ?? '',
    d.situation_professionnelle ?? '',
    d.emprunt_a_deux ? 'Oui' : 'Non',
    new Date(d.created_at).toLocaleDateString('fr-FR'),
    new Date(d.updated_at).toLocaleDateString('fr-FR'),
  ])

  const csvContent = BOM + [
    headers.join(';'),
    ...rows.map(row => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(';'))
  ].join('\n')

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="dossiers_export_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
