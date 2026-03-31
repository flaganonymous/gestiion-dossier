export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { Navbar } from '@/components/navbar'
import { DossierDetail } from './dossier-detail'

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { profile } = await getAuthUser()
  const supabase = await createClient()

  const { data: dossier } = await supabase
    .from('dossiers')
    .select(`
      *,
      client:client_id(id, nom, prenom, email),
      apporteur:apporteur_id(id, nom, prenom, email)
    `)
    .eq('id', id)
    .single()

  if (!dossier) notFound()

  const { data: documents } = await supabase
    .from('documents')
    .select('*, uploade_par_profile:uploade_par(nom, prenom)')
    .eq('dossier_id', id)
    .order('created_at', { ascending: false })

  const { data: historique } = await supabase
    .from('historique_statuts')
    .select('*, modifie_par_profile:modifie_par(nom, prenom)')
    .eq('dossier_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile} />
      <DossierDetail
        dossier={dossier}
        documents={documents ?? []}
        historique={historique ?? []}
        profile={profile}
      />
    </div>
  )
}
