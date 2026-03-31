export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { UsersClient } from './users-client'

export default async function UtilisateursPage() {
  const { profile } = await getAuthUser()
  if (profile.role !== 'admin') redirect('/dashboard')

  const supabase = await createClient()
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile} />
      <UsersClient initialUsers={users ?? []} />
    </div>
  )
}
