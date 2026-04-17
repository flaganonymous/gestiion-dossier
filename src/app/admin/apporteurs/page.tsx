export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { ApporteursClient } from './apporteurs-client'
import type { Apporteur } from '@/lib/supabase/types'

export default async function ApporteursPage() {
  const { profile } = await getAuthUser()
  if (profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data } = await supabase.from('apporteurs').select('*').order('nom')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile} />
      <ApporteursClient initial={(data ?? []) as Apporteur[]} />
    </div>
  )
}
