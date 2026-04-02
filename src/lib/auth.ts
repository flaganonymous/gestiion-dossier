import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Profile } from '@/lib/supabase/types'
import { redirect } from 'next/navigation'

/**
 * Récupère l'utilisateur connecté et son profil.
 * Utilise le service_role pour lire le profil (bypass RLS — évite la récursion infinie).
 * Redirige vers /login si non connecté.
 */
export async function getAuthUser(): Promise<{ user: { id: string; email: string }, profile: Profile }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Utilise le client admin (service_role) pour éviter la récursion RLS sur profiles
  const admin = await createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  if (!profile.actif) {
    await supabase.auth.signOut()
    redirect('/login')
  }

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
