import { createClient } from '@/lib/supabase/server'
import { Profile } from '@/lib/supabase/types'
import { redirect } from 'next/navigation'

/**
 * Récupère l'utilisateur connecté et son profil.
 * Redirige vers /login si non connecté.
 */
export async function getAuthUser(): Promise<{ user: { id: string; email: string }, profile: Profile }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.actif) redirect('/login')

  return { user: { id: user.id, email: user.email ?? '' }, profile }
}

/**
 * Vérifie que l'utilisateur est admin ou collaborateur.
 */
export async function requireAdminOrCollaborateur() {
  const { profile } = await getAuthUser()
  if (!['admin', 'collaborateur'].includes(profile.role)) {
    redirect('/dashboard')
  }
  return profile
}
