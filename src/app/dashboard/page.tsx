export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { Navbar } from '@/components/navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STATUT_COLORS, STATUT_LABELS } from '@/lib/supabase/types'
import Link from 'next/link'
import { FolderOpen, FolderCheck, FolderX, Plus, Clock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

export default async function DashboardPage() {
  const { profile } = await getAuthUser()
  const supabase = await createClient()

  // Requête selon le rôle
  let query = supabase
    .from('dossiers')
    .select(`
      id, titre, annee, statut, created_at, updated_at,
      client:client_id(nom, prenom),
      apporteur:apporteur_id(nom, prenom)
    `)
    .order('updated_at', { ascending: false })

  if (profile.role === 'apporteur') {
    query = query.eq('apporteur_id', profile.id)
  } else if (profile.role === 'client') {
    query = query.eq('client_id', profile.id)
  }

  const { data: dossiers = [] } = await query.limit(50)

  const stats = {
    en_cours: dossiers?.filter(d => d.statut === 'en_cours').length ?? 0,
    finance: dossiers?.filter(d => d.statut === 'finance').length ?? 0,
    refuse: dossiers?.filter(d => d.statut === 'refuse').length ?? 0,
  }

  const recents = dossiers?.slice(0, 5) ?? []

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Bonjour, {profile.prenom}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Voici un aperçu de l'activité
            </p>
          </div>
          {['admin', 'collaborateur', 'apporteur'].includes(profile.role) && (
            <Link href="/dossiers/nouveau">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau dossier
              </Button>
            </Link>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">En cours</CardTitle>
              <FolderOpen className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{stats.en_cours}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Financés</CardTitle>
              <FolderCheck className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{stats.finance}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Refusés</CardTitle>
              <FolderX className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-gray-900">{stats.refuse}</p>
            </CardContent>
          </Card>
        </div>

        {/* Dossiers récents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Derniers dossiers</CardTitle>
            <Link href="/dossiers">
              <Button variant="ghost" size="sm">Voir tout</Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>Aucun dossier pour le moment</p>
                {['admin', 'collaborateur', 'apporteur'].includes(profile.role) && (
                  <Link href="/dossiers/nouveau">
                    <Button className="mt-4">Créer le premier dossier</Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {recents.map((dossier: any) => (
                  <Link
                    key={dossier.id}
                    href={`/dossiers/${dossier.id}`}
                    className="flex items-center justify-between py-3 hover:bg-gray-50 -mx-6 px-6 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FolderOpen className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{dossier.titre}</p>
                        <p className="text-xs text-gray-500">
                          {dossier.client
                            ? `${(dossier.client as any).prenom} ${(dossier.client as any).nom}`
                            : 'Sans client'}
                          {' · '}
                          {dossier.annee}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={STATUT_COLORS[dossier.statut as keyof typeof STATUT_COLORS]}>
                        {STATUT_LABELS[dossier.statut as keyof typeof STATUT_LABELS]}
                      </Badge>
                      <span className="text-xs text-gray-400 flex items-center gap-1 hidden sm:flex">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(dossier.updated_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
