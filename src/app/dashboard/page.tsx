export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { Navbar } from '@/components/navbar'
import { STATUT_COLORS, STATUT_LABELS } from '@/lib/supabase/types'
import Link from 'next/link'
import { FolderOpen, FolderCheck, FolderX, Plus, Clock, ArrowRight, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUT_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  en_cours: { bg: '#FFF5EB', color: '#EE7D07', label: 'En cours' },
  finance: { bg: '#DCFCE7', color: '#16a34a', label: 'Financé' },
  refuse: { bg: '#FEF2F2', color: '#dc2626', label: 'Refusé' },
}

export default async function DashboardPage() {
  const { profile } = await getAuthUser()
  const supabase = await createClient()

  let query = supabase
    .from('dossiers')
    .select(`id, titre, annee, statut, created_at, updated_at, client:client_id(nom, prenom), apporteur:apporteur_id(nom, prenom)`)
    .order('updated_at', { ascending: false })

  if (profile.role === 'client') query = query.eq('client_id', profile.id)

  const { data: dossiers = [] } = await query.limit(50)

  const stats = {
    en_cours: dossiers?.filter(d => d.statut === 'en_cours').length ?? 0,
    finance: dossiers?.filter(d => d.statut === 'finance').length ?? 0,
    refuse: dossiers?.filter(d => d.statut === 'refuse').length ?? 0,
  }

  const recents = dossiers?.slice(0, 6) ?? []

  // Client role gets a simplified, welcoming dashboard
  if (profile.role === 'client') {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
        <Navbar profile={profile} />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px', color: '#112337' }}>
              Bienvenue, {profile.prenom}
            </h1>
            <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#585e6a', marginTop: '4px' }}>
              Consultez et complétez vos dossiers
            </p>
          </div>

          {dossiers && dossiers.length > 0 ? (
            <>
              {/* Primary dossier card */}
              <Link href={`/dossiers/${dossiers[0].id}`}>
                <div style={{
                  background: '#fff', borderRadius: '12px', padding: '28px',
                  boxShadow: '0 1px 4px rgba(17,35,55,0.06)',
                  borderLeft: '4px solid #EE7D07',
                  cursor: 'pointer', transition: 'box-shadow 0.2s', marginBottom: '20px',
                }} className="hover:shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px', color: '#112337' }}>
                      {dossiers[0].titre}
                    </h2>
                    <span style={{
                      background: (STATUT_BADGE[dossiers[0].statut] ?? STATUT_BADGE.en_cours).bg,
                      color: (STATUT_BADGE[dossiers[0].statut] ?? STATUT_BADGE.en_cours).color,
                      padding: '4px 12px', borderRadius: '20px',
                      fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '12px',
                    }}>
                      {(STATUT_BADGE[dossiers[0].statut] ?? STATUT_BADGE.en_cours).label}
                    </span>
                  </div>
                  <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a', marginBottom: '16px' }}>
                    Annee : {dossiers[0].annee}
                  </p>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    background: '#EE7D07', color: '#fff',
                    padding: '10px 20px', borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                  }}>
                    Acceder a mon dossier
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>

              {/* Additional dossiers if multiple */}
              {dossiers.length > 1 && (
                <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', marginBottom: '20px' }}>
                  <div className="px-6 py-4" style={{ borderBottom: '1px solid #EBEBEB' }}>
                    <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
                      Tous mes dossiers
                    </h2>
                  </div>
                  {dossiers.map((dossier: any, idx: number) => {
                    const dBadge = STATUT_BADGE[dossier.statut] ?? STATUT_BADGE.en_cours
                    return (
                      <Link key={dossier.id} href={`/dossiers/${dossier.id}`}>
                        <div
                          className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                          style={{ borderBottom: idx < dossiers.length - 1 ? '1px solid #EBEBEB' : 'none' }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div style={{ background: '#FFF5EB', borderRadius: '8px' }} className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
                              <FolderOpen className="h-4 w-4" style={{ color: '#EE7D07' }} />
                            </div>
                            <div className="min-w-0">
                              <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337' }} className="truncate">
                                {dossier.titre}
                              </p>
                              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
                                {dossier.annee}
                              </p>
                            </div>
                          </div>
                          <span style={{
                            background: dBadge.bg, color: dBadge.color,
                            padding: '3px 10px', borderRadius: '20px',
                            fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '12px',
                          }}>
                            {dBadge.label}
                          </span>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <div style={{
              background: '#fff', borderRadius: '12px', padding: '48px 24px',
              boxShadow: '0 1px 4px rgba(17,35,55,0.06)', textAlign: 'center',
            }}>
              <FileText className="h-14 w-14 mx-auto mb-4" style={{ color: '#EBEBEB' }} />
              <p style={{ fontFamily: 'Open Sans, sans-serif', color: '#585e6a', fontSize: '15px' }}>
                Aucun dossier pour le moment.
              </p>
              <p style={{ fontFamily: 'Open Sans, sans-serif', color: '#585e6a', fontSize: '13px', marginTop: '8px' }}>
                Votre conseiller vous contactera prochainement.
              </p>
            </div>
          )}
        </main>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <Navbar profile={profile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px', color: '#112337' }}>
              Bonjour, {profile.prenom} 👋
            </h1>
            <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#585e6a', marginTop: '4px' }}>
              Voici un aperçu de votre activité
            </p>
          </div>
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

        {/* Cartes stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          {[
            { key: 'en_cours', label: 'En cours', count: stats.en_cours, icon: FolderOpen, bg: '#FFF5EB', iconColor: '#EE7D07', accent: '#EE7D07' },
            { key: 'finance', label: 'Financés', count: stats.finance, icon: FolderCheck, bg: '#DCFCE7', iconColor: '#16a34a', accent: '#16a34a' },
            { key: 'refuse', label: 'Refusés', count: stats.refuse, icon: FolderX, bg: '#FEF2F2', iconColor: '#dc2626', accent: '#dc2626' },
          ].map(stat => (
            <Link key={stat.key} href={`/dossiers?statut=${stat.key}`}>
              <div style={{
                background: '#fff', borderRadius: '12px', padding: '24px',
                boxShadow: '0 1px 4px rgba(17,35,55,0.06)',
                borderLeft: `4px solid ${stat.accent}`,
                transition: 'box-shadow 0.2s', cursor: 'pointer',
              }}
                className="hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-3">
                  <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a', fontWeight: 600 }}>
                    {stat.label}
                  </p>
                  <div style={{ background: stat.bg, borderRadius: '8px' }} className="w-9 h-9 flex items-center justify-center">
                    <stat.icon className="h-5 w-5" style={{ color: stat.iconColor }} />
                  </div>
                </div>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '36px', color: '#112337', lineHeight: 1 }}>
                  {stat.count}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Dossiers récents */}
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #EBEBEB' }}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
              Derniers dossiers
            </h2>
            <Link href="/dossiers" className="flex items-center gap-1" style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#EE7D07', fontWeight: 600 }}>
              Voir tout <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recents.length === 0 ? (
            <div className="text-center py-16">
              <FolderOpen className="h-14 w-14 mx-auto mb-4" style={{ color: '#EBEBEB' }} />
              <p style={{ fontFamily: 'Open Sans, sans-serif', color: '#585e6a', fontSize: '14px' }}>
                Aucun dossier pour le moment
              </p>
              {['admin', 'collaborateur'].includes(profile.role) && (
                <Link href="/dossiers/nouveau">
                  <button style={{
                    marginTop: '16px', padding: '10px 20px',
                    background: '#EE7D07', color: '#fff', border: 'none',
                    borderRadius: '8px', fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600, fontSize: '14px', cursor: 'pointer',
                  }}>
                    Créer le premier dossier
                  </button>
                </Link>
              )}
            </div>
          ) : (
            <div>
              {recents.map((dossier: any, idx: number) => {
                const badge = STATUT_BADGE[dossier.statut] ?? STATUT_BADGE.en_cours
                return (
                  <Link key={dossier.id} href={`/dossiers/${dossier.id}`}>
                    <div
                      className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      style={{ borderBottom: idx < recents.length - 1 ? '1px solid #EBEBEB' : 'none' }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div style={{ background: '#FFF5EB', borderRadius: '8px' }} className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
                          <FolderOpen className="h-4 w-4" style={{ color: '#EE7D07' }} />
                        </div>
                        <div className="min-w-0">
                          <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337' }} className="truncate">
                            {dossier.titre}
                          </p>
                          <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
                            {dossier.client ? `${(dossier.client as any).prenom} ${(dossier.client as any).nom}` : 'Sans client'}
                            {' · '}{dossier.annee}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                        <span style={{ background: badge.bg, color: badge.color, padding: '3px 10px', borderRadius: '20px', fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '12px' }}>
                          {badge.label}
                        </span>
                        <span className="hidden sm:flex items-center gap-1" style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(dossier.updated_at), { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
