export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { Navbar } from '@/components/navbar'
import { STATUT_LABELS } from '@/lib/supabase/types'
import Link from 'next/link'
import { FolderOpen, Plus, Search, FileDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUT_BADGE: Record<string, { bg: string; color: string }> = {
  en_cours: { bg: '#FFF5EB', color: '#EE7D07' },
  finance: { bg: '#DCFCE7', color: '#16a34a' },
  refuse: { bg: '#FEF2F2', color: '#dc2626' },
}

interface SearchParams { statut?: string; annee?: string; q?: string }

export default async function DossiersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const { profile } = await getAuthUser()
  const supabase = await createClient()

  let query = supabase
    .from('dossiers')
    .select(`id, titre, annee, statut, created_at, updated_at, client:client_id(nom, prenom), apporteur:apporteur_id(nom, prenom)`)
    .order('updated_at', { ascending: false })

  if (profile.role === 'client') query = query.eq('client_id', profile.id)
  if (params.statut && ['en_cours', 'refuse', 'finance'].includes(params.statut)) query = query.eq('statut', params.statut)
  if (params.annee) query = query.eq('annee', parseInt(params.annee))
  if (params.q) query = query.ilike('titre', `%${params.q}%`)

  const { data: dossiers = [] } = await query
  const annees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const isClient = profile.role === 'client'

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <Navbar profile={profile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px', color: '#112337' }}>
              {isClient ? 'Mes dossiers' : 'Dossiers'}
            </h1>
            <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#585e6a', marginTop: '2px' }}>
              {dossiers?.length ?? 0} dossier{(dossiers?.length ?? 0) > 1 ? 's' : ''}
              {params.statut ? ` · filtre : ${STATUT_LABELS[params.statut as keyof typeof STATUT_LABELS]}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {['admin', 'collaborateur'].includes(profile.role) && (
              <a href={`/api/dossiers/export?${params.statut ? `statut=${params.statut}&` : ''}${params.annee ? `annee=${params.annee}` : ''}`}>
                <button style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#fff', color: '#585e6a', border: '1.5px solid #EBEBEB',
                  padding: '10px 20px', borderRadius: '8px',
                  fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                  cursor: 'pointer',
                }}>
                  <FileDown className="h-4 w-4" />
                  Export CSV
                </button>
              </a>
            )}
            {['admin', 'collaborateur'].includes(profile.role) && (
              <Link href="/dossiers/nouveau">
                <button style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#EE7D07', color: '#fff', border: 'none',
                  padding: '10px 20px', borderRadius: '8px',
                  fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                  cursor: 'pointer',
                }}>
                  <Plus className="h-4 w-4" />
                  Nouveau dossier
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Filtres */}
        {!isClient && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
          <div className="flex flex-wrap gap-3 items-center">

            {/* Recherche */}
            <form method="GET" className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#585e6a' }} />
                <input
                  name="q"
                  defaultValue={params.q}
                  placeholder="Rechercher un dossier..."
                  style={{
                    paddingLeft: '36px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px',
                    border: '1.5px solid #EBEBEB', borderRadius: '8px',
                    fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337',
                    outline: 'none', width: '200px',
                  }}
                />
              </div>
              <button type="submit" style={{
                padding: '8px 14px', border: '1.5px solid #EBEBEB', borderRadius: '8px',
                background: '#fff', fontFamily: 'Open Sans, sans-serif', fontSize: '13px',
                color: '#112337', cursor: 'pointer',
              }}>
                Chercher
              </button>
            </form>

            <div style={{ width: '1px', height: '28px', background: '#EBEBEB' }} className="hidden sm:block" />

            {/* Filtres statut */}
            <div className="flex gap-2 flex-wrap">
              {[
                { value: '', label: 'Tous' },
                { value: 'en_cours', label: 'En cours' },
                { value: 'finance', label: 'Financés' },
                { value: 'refuse', label: 'Refusés' },
              ].map(f => {
                const active = (params.statut ?? '') === f.value
                return (
                  <Link key={f.value} href={f.value ? `/dossiers?statut=${f.value}` : '/dossiers'}>
                    <span style={{
                      display: 'inline-block', padding: '6px 14px', borderRadius: '20px',
                      fontFamily: 'Open Sans, sans-serif', fontSize: '13px', fontWeight: active ? 600 : 400,
                      background: active ? '#EE7D07' : '#F5F5F5',
                      color: active ? '#fff' : '#585e6a',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                      {f.label}
                    </span>
                  </Link>
                )
              })}
            </div>

            <div style={{ width: '1px', height: '28px', background: '#EBEBEB' }} className="hidden sm:block" />

            {/* Filtres année */}
            <div className="flex gap-2 flex-wrap">
              {annees.map(annee => {
                const active = params.annee === String(annee)
                return (
                  <Link key={annee} href={`/dossiers?annee=${annee}${params.statut ? `&statut=${params.statut}` : ''}`}>
                    <span style={{
                      display: 'inline-block', padding: '6px 14px', borderRadius: '20px',
                      fontFamily: 'Open Sans, sans-serif', fontSize: '13px', fontWeight: active ? 600 : 400,
                      background: active ? '#112337' : '#F5F5F5',
                      color: active ? '#fff' : '#585e6a',
                      cursor: 'pointer',
                    }}>
                      {annee}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
        )}

        {/* Liste */}
        {!dossiers || dossiers.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: '12px', padding: '64px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
            <FolderOpen className="h-16 w-16 mx-auto mb-4" style={{ color: '#EBEBEB' }} />
            <p style={{ fontFamily: 'Open Sans, sans-serif', color: '#585e6a', fontSize: '15px', marginBottom: '16px' }}>
              Aucun dossier trouvé
            </p>
            {['admin', 'collaborateur'].includes(profile.role) && (
              <Link href="/dossiers/nouveau">
                <button style={{
                  padding: '10px 24px', background: '#EE7D07', color: '#fff',
                  border: 'none', borderRadius: '8px',
                  fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                }}>
                  Créer un dossier
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', overflow: 'hidden' }}>
            {dossiers.map((dossier: any, idx: number) => {
              const badge = STATUT_BADGE[dossier.statut] ?? STATUT_BADGE.en_cours
              return (
                <Link key={dossier.id} href={`/dossiers/${dossier.id}`}>
                  <div
                    className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    style={{ borderBottom: idx < dossiers.length - 1 ? '1px solid #EBEBEB' : 'none' }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div style={{ background: '#FFF5EB', borderRadius: '8px' }} className="w-10 h-10 flex-shrink-0 flex items-center justify-center">
                        <FolderOpen className="h-5 w-5" style={{ color: '#EE7D07' }} />
                      </div>
                      <div className="min-w-0">
                        <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337' }} className="truncate">
                          {dossier.titre}
                        </p>
                        <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
                          {dossier.annee}
                          {dossier.client && <> · {(dossier.client as any).prenom} {(dossier.client as any).nom}</>}
                          {dossier.apporteur && ['admin', 'collaborateur'].includes(profile.role) && (
                            <> · {(dossier.apporteur as any).prenom} {(dossier.apporteur as any).nom}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                      <span style={{
                        background: badge.bg, color: badge.color,
                        padding: '3px 12px', borderRadius: '20px',
                        fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '12px',
                      }}>
                        {STATUT_LABELS[dossier.statut as keyof typeof STATUT_LABELS]}
                      </span>
                      <span className="hidden sm:block" style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
                        {formatDistanceToNow(new Date(dossier.updated_at), { addSuffix: true, locale: fr })}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
