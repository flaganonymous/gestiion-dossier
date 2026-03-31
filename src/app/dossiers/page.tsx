export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { Navbar } from '@/components/navbar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { STATUT_COLORS, STATUT_LABELS } from '@/lib/supabase/types'
import Link from 'next/link'
import { FolderOpen, Plus, Search } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface SearchParams {
  statut?: string
  annee?: string
  q?: string
}

export default async function DossiersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const { profile } = await getAuthUser()
  const supabase = await createClient()

  let query = supabase
    .from('dossiers')
    .select(`
      id, titre, annee, statut, created_at, updated_at,
      client:client_id(nom, prenom),
      apporteur:apporteur_id(nom, prenom)
    `)
    .order('updated_at', { ascending: false })

  // Filtrage par rôle
  if (profile.role === 'apporteur') query = query.eq('apporteur_id', profile.id)
  if (profile.role === 'client') query = query.eq('client_id', profile.id)

  // Filtres URL
  if (params.statut && ['en_cours', 'refuse', 'finance'].includes(params.statut)) {
    query = query.eq('statut', params.statut)
  }
  if (params.annee) query = query.eq('annee', parseInt(params.annee))
  if (params.q) query = query.ilike('titre', `%${params.q}%`)

  const { data: dossiers = [] } = await query

  const annees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dossiers</h1>
          {['admin', 'collaborateur', 'apporteur'].includes(profile.role) && (
            <Link href="/dossiers/nouveau">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau dossier
              </Button>
            </Link>
          )}
        </div>

        {/* Filtres */}
        <div className="flex flex-wrap gap-3 mb-6">
          <form method="GET" className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                name="q"
                defaultValue={params.q}
                placeholder="Rechercher..."
                className="pl-9 w-48"
              />
            </div>
            <Button type="submit" variant="outline" size="sm">Filtrer</Button>
          </form>

          <div className="flex gap-2 flex-wrap">
            <Link
              href="/dossiers"
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                !params.statut ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}
            >
              Tous
            </Link>
            {(['en_cours', 'finance', 'refuse'] as const).map(s => (
              <Link
                key={s}
                href={`/dossiers?statut=${s}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  params.statut === s ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
                }`}
              >
                {STATUT_LABELS[s]}
              </Link>
            ))}
          </div>

          <div className="flex gap-2">
            {annees.map(annee => (
              <Link
                key={annee}
                href={`/dossiers?annee=${annee}${params.statut ? `&statut=${params.statut}` : ''}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  params.annee === String(annee) ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'
                }`}
              >
                {annee}
              </Link>
            ))}
          </div>
        </div>

        {/* Liste */}
        {!dossiers || dossiers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16">
              <FolderOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4">Aucun dossier trouvé</p>
              {['admin', 'collaborateur', 'apporteur'].includes(profile.role) && (
                <Link href="/dossiers/nouveau">
                  <Button>Créer un dossier</Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {dossiers.map((dossier: any) => (
              <Link key={dossier.id} href={`/dossiers/${dossier.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <FolderOpen className="h-5 w-5 text-blue-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">{dossier.titre}</p>
                          <p className="text-sm text-gray-500">
                            {dossier.annee}
                            {dossier.client && (
                              <> · Client : {(dossier.client as any).prenom} {(dossier.client as any).nom}</>
                            )}
                            {dossier.apporteur && ['admin', 'collaborateur'].includes(profile.role) && (
                              <> · Apporteur : {(dossier.apporteur as any).prenom} {(dossier.apporteur as any).nom}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        <Badge className={STATUT_COLORS[dossier.statut as keyof typeof STATUT_COLORS]}>
                          {STATUT_LABELS[dossier.statut as keyof typeof STATUT_LABELS]}
                        </Badge>
                        <span className="text-xs text-gray-400 hidden sm:block">
                          {formatDistanceToNow(new Date(dossier.updated_at), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
