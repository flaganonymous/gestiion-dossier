export const dynamic = 'force-dynamic'

import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { STATUT_LABELS, type DossierStatut } from '@/lib/supabase/types'
import Link from 'next/link'
import {
  FolderOpen, FolderCheck, FolderX, Users as UsersIcon, Briefcase,
  Mail, CheckCircle2, XCircle, LogIn, UserPlus, TrendingUp,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUT_COLOR: Record<DossierStatut, string> = {
  en_cours: '#EE7D07',
  finance: '#16a34a',
  refuse: '#dc2626',
}

function daysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function startOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toISOString()
}

export default async function StatistiquesPage() {
  const { profile } = await getAuthUser()
  if (profile.role !== 'admin') redirect('/dashboard')

  const admin = await createAdminClient()
  const now = new Date()
  const d7 = daysAgo(7)
  const d30 = daysAgo(30)

  // ---------------- DOSSIERS ----------------
  const [
    dossiersAll,
    dossiers30,
    dossiers7,
  ] = await Promise.all([
    admin.from('dossiers').select('id, statut, annee, created_at, apporteur_id, client_id'),
    admin.from('dossiers').select('id', { count: 'exact', head: true }).gte('created_at', d30),
    admin.from('dossiers').select('id', { count: 'exact', head: true }).gte('created_at', d7),
  ])

  const dossiersList = (dossiersAll.data ?? []) as Array<{
    id: string; statut: DossierStatut; annee: number;
    created_at: string; apporteur_id: string | null; client_id: string | null;
  }>

  const totalDossiers = dossiersList.length
  const parStatut: Record<DossierStatut, number> = { en_cours: 0, finance: 0, refuse: 0 }
  const parAnnee: Record<number, number> = {}
  const parMois: Record<string, number> = {} // "YYYY-MM" -> count
  const dossiersParApporteur: Record<string, { total: number; finance: number }> = {}

  // Build last 12 months keys
  const mois12: Array<{ key: string; label: string }> = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    mois12.push({ key, label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) })
    parMois[key] = 0
  }
  const seuil12Mois = startOfMonth(now.getFullYear(), now.getMonth() - 11)

  for (const d of dossiersList) {
    parStatut[d.statut] = (parStatut[d.statut] ?? 0) + 1
    parAnnee[d.annee] = (parAnnee[d.annee] ?? 0) + 1
    if (d.created_at >= seuil12Mois) {
      const dt = new Date(d.created_at)
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      if (key in parMois) parMois[key]++
    }
    if (d.apporteur_id) {
      const agg = dossiersParApporteur[d.apporteur_id] ?? { total: 0, finance: 0 }
      agg.total++
      if (d.statut === 'finance') agg.finance++
      dossiersParApporteur[d.apporteur_id] = agg
    }
  }

  // ---------------- APPORTEURS ----------------
  const { data: apporteursData = [] } = await admin
    .from('apporteurs')
    .select('id, nom, prenom, actif')

  const apporteursById = new Map(apporteursData!.map(a => [a.id, a]))
  const topApporteurs = Object.entries(dossiersParApporteur)
    .map(([id, agg]) => ({ id, ...agg, apporteur: apporteursById.get(id) }))
    .filter(a => a.apporteur)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const totalApporteursActifs = apporteursData!.filter(a => a.actif).length

  // ---------------- CLIENTS ----------------
  const [
    clientsAll,
    clients30,
  ] = await Promise.all([
    admin.from('profiles').select('id, nom, prenom, email, created_at').eq('role', 'client'),
    admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client').gte('created_at', d30),
  ])

  const clientsList = (clientsAll.data ?? []) as Array<{
    id: string; nom: string; prenom: string; email: string; created_at: string
  }>
  const totalClients = clientsList.length

  // Dossiers par client (nouveaux dossiers côté client)
  const dossiersParClient: Record<string, number> = {}
  for (const d of dossiersList) {
    if (d.client_id) dossiersParClient[d.client_id] = (dossiersParClient[d.client_id] ?? 0) + 1
  }
  const clientsSansDossier = clientsList.filter(c => !dossiersParClient[c.id]).length
  const clientsAvecDossier = totalClients - clientsSansDossier

  // ---------------- EMAILS ----------------
  const [
    emailsAll30,
    emailsRecent,
  ] = await Promise.all([
    admin.from('email_logs').select('template_slug, success, created_at').gte('created_at', d30),
    admin.from('email_logs').select('id, template_slug, destinataire, sujet, success, erreur, created_at').order('created_at', { ascending: false }).limit(10),
  ])

  const emails30 = (emailsAll30.data ?? []) as Array<{ template_slug: string | null; success: boolean; created_at: string }>
  const totalEmails30 = emails30.length
  const emailsSucces30 = emails30.filter(e => e.success).length
  const emailsEchec30 = totalEmails30 - emailsSucces30
  const tauxSucces = totalEmails30 > 0 ? Math.round((emailsSucces30 / totalEmails30) * 100) : null

  const emailsParTemplate: Record<string, { ok: number; ko: number }> = {}
  for (const e of emails30) {
    const key = e.template_slug ?? 'inconnu'
    const agg = emailsParTemplate[key] ?? { ok: 0, ko: 0 }
    if (e.success) agg.ok++; else agg.ko++
    emailsParTemplate[key] = agg
  }

  // ---------------- CONNEXIONS ----------------
  const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const clientIds = new Set(clientsList.map(c => c.id))
  const authClientEntries = (authUsers?.users ?? [])
    .filter(u => clientIds.has(u.id))
    .map(u => {
      const profil = clientsList.find(c => c.id === u.id)
      return {
        id: u.id,
        email: u.email ?? profil?.email ?? '',
        nom: profil ? `${profil.prenom} ${profil.nom}` : '',
        last_sign_in_at: u.last_sign_in_at ?? null,
        created_at: u.created_at ?? null,
      }
    })

  const clientsConnectes = authClientEntries.filter(e => e.last_sign_in_at).length
  const clientsJamaisConnectes = authClientEntries.filter(e => !e.last_sign_in_at).length
  const connexions7 = authClientEntries.filter(e => e.last_sign_in_at && e.last_sign_in_at >= d7).length
  const connexions30 = authClientEntries.filter(e => e.last_sign_in_at && e.last_sign_in_at >= d30).length
  const dernieresConnexions = [...authClientEntries]
    .filter(e => e.last_sign_in_at)
    .sort((a, b) => (b.last_sign_in_at! > a.last_sign_in_at! ? 1 : -1))
    .slice(0, 8)

  // ---------------- RENDERING HELPERS ----------------
  const maxMois = Math.max(1, ...Object.values(parMois))
  const maxApporteur = Math.max(1, ...topApporteurs.map(a => a.total))
  const maxTemplate = Math.max(1, ...Object.values(emailsParTemplate).map(v => v.ok + v.ko))

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <Navbar profile={profile} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px', color: '#112337' }}>
            Statistiques
          </h1>
          <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#585e6a', marginTop: '2px' }}>
            Vue d'ensemble — dossiers, apporteurs, emails et activité clients
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Dossiers', value: totalDossiers, sub: `+${dossiers30.count ?? 0} sur 30j · +${dossiers7.count ?? 0} sur 7j`, icon: FolderOpen, bg: '#FFF5EB', fg: '#EE7D07' },
            { label: 'Clients', value: totalClients, sub: `+${clients30.count ?? 0} sur 30j`, icon: UsersIcon, bg: '#EFF6FF', fg: '#2563eb' },
            { label: 'Apporteurs actifs', value: totalApporteursActifs, sub: `${apporteursData!.length} au total`, icon: Briefcase, bg: '#F3E8FF', fg: '#7c3aed' },
            { label: 'Emails 30j', value: totalEmails30, sub: tauxSucces !== null ? `${tauxSucces}% succès` : 'Aucun envoi', icon: Mail, bg: '#FEF3C7', fg: '#d97706' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
              <div className="flex items-start justify-between mb-3">
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {k.label}
                </p>
                <div style={{ background: k.bg, borderRadius: '8px' }} className="w-8 h-8 flex items-center justify-center">
                  <k.icon className="h-4 w-4" style={{ color: k.fg }} />
                </div>
              </div>
              <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '28px', color: '#112337', lineHeight: 1 }}>
                {k.value}
              </p>
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a', marginTop: '6px' }}>
                {k.sub}
              </p>
            </div>
          ))}
        </div>

        {/* Dossiers : statut + évolution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337', marginBottom: '16px' }}>
              Dossiers par statut
            </h2>
            {(['en_cours', 'finance', 'refuse'] as DossierStatut[]).map(st => {
              const count = parStatut[st]
              const pct = totalDossiers > 0 ? Math.round((count / totalDossiers) * 100) : 0
              return (
                <div key={st} className="mb-3 last:mb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', fontWeight: 500 }}>
                      {STATUT_LABELS[st]}
                    </span>
                    <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                      {count} <span style={{ color: '#9ca3af' }}>· {pct}%</span>
                    </span>
                  </div>
                  <div style={{ height: '6px', background: '#F5F5F5', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: STATUT_COLOR[st], borderRadius: '3px' }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="lg:col-span-2" style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
                Nouveaux dossiers — 12 derniers mois
              </h2>
              <TrendingUp className="h-4 w-4" style={{ color: '#585e6a' }} />
            </div>
            <div className="flex items-end gap-2" style={{ height: '140px' }}>
              {mois12.map(m => {
                const count = parMois[m.key]
                const h = Math.round((count / maxMois) * 100)
                return (
                  <div key={m.key} className="flex-1 flex flex-col items-center gap-1" title={`${m.label} : ${count} dossier(s)`}>
                    <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '10px', color: '#585e6a', fontWeight: 600 }}>{count || ''}</span>
                    <div style={{ width: '100%', height: `${h}%`, minHeight: count > 0 ? '4px' : '0', background: '#EE7D07', borderRadius: '4px 4px 0 0' }} />
                  </div>
                )
              })}
            </div>
            <div className="flex gap-2 mt-2">
              {mois12.map(m => (
                <span key={m.key} className="flex-1 text-center" style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '10px', color: '#585e6a' }}>
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Dossiers par année */}
        <div className="mb-6" style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337', marginBottom: '12px' }}>
            Répartition par année de dossier
          </h2>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(parAnnee).sort((a, b) => Number(b[0]) - Number(a[0])).map(([annee, count]) => (
              <Link key={annee} href={`/dossiers?annee=${annee}`}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '6px 14px', borderRadius: '20px',
                  background: '#F5F5F5', color: '#112337',
                  fontFamily: 'Open Sans, sans-serif', fontSize: '13px', cursor: 'pointer',
                }}>
                  <strong>{annee}</strong>
                  <span style={{ color: '#585e6a' }}>{count}</span>
                </span>
              </Link>
            ))}
            {Object.keys(parAnnee).length === 0 && (
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>Aucun dossier.</p>
            )}
          </div>
        </div>

        {/* Top apporteurs */}
        <div className="mb-6" style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #EBEBEB' }}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
              Top apporteurs
            </h2>
            <Link href="/admin/apporteurs" style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#EE7D07', fontWeight: 600 }}>
              Gérer →
            </Link>
          </div>
          {topApporteurs.length === 0 ? (
            <div className="py-10 text-center">
              <Briefcase className="h-10 w-10 mx-auto mb-2" style={{ color: '#EBEBEB' }} />
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                Aucun dossier n'est encore rattaché à un apporteur.
              </p>
            </div>
          ) : (
            <div>
              {topApporteurs.map((a, idx) => {
                const pct = Math.round((a.total / maxApporteur) * 100)
                const tauxFinance = a.total > 0 ? Math.round((a.finance / a.total) * 100) : 0
                return (
                  <Link key={a.id} href={`/dossiers?apporteur_id=${a.id}`}>
                    <div className="px-5 py-3 hover:bg-gray-50 transition-colors" style={{ borderBottom: idx < topApporteurs.length - 1 ? '1px solid #EBEBEB' : 'none' }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', fontWeight: 600, color: '#112337' }}>
                          {a.apporteur!.prenom} {a.apporteur!.nom}
                          {!a.apporteur!.actif && <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: '6px' }}>(inactif)</span>}
                        </span>
                        <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
                          <strong style={{ color: '#112337' }}>{a.total}</strong> dossier{a.total > 1 ? 's' : ''} · {a.finance} financé{a.finance > 1 ? 's' : ''} ({tauxFinance}%)
                        </span>
                      </div>
                      <div style={{ height: '5px', background: '#F5F5F5', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: '#7c3aed', borderRadius: '3px' }} />
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Emails — envois par template + échecs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337', marginBottom: '16px' }}>
              Emails 30 jours
            </h2>
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1" style={{ background: '#DCFCE7', padding: '10px 12px', borderRadius: '8px' }}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4" style={{ color: '#16a34a' }} />
                  <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>Succès</span>
                </div>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337' }}>{emailsSucces30}</p>
              </div>
              <div className="flex-1" style={{ background: '#FEF2F2', padding: '10px 12px', borderRadius: '8px' }}>
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="h-4 w-4" style={{ color: '#dc2626' }} />
                  <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>Échecs</span>
                </div>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337' }}>{emailsEchec30}</p>
              </div>
            </div>
            <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
              {tauxSucces !== null ? `Taux de délivrance : ${tauxSucces}%` : 'Aucun envoi sur la période.'}
            </p>
          </div>

          <div className="lg:col-span-2" style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337', marginBottom: '16px' }}>
              Répartition par template
            </h2>
            {Object.keys(emailsParTemplate).length === 0 ? (
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                Aucun email envoyé sur les 30 derniers jours.
              </p>
            ) : (
              Object.entries(emailsParTemplate).sort((a, b) => (b[1].ok + b[1].ko) - (a[1].ok + a[1].ko)).map(([slug, agg]) => {
                const total = agg.ok + agg.ko
                const pctOk = Math.round((agg.ok / total) * 100)
                const pct = Math.round((total / maxTemplate) * 100)
                return (
                  <div key={slug} className="mb-3 last:mb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', fontWeight: 500 }}>
                        {slug}
                      </span>
                      <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
                        <strong style={{ color: '#112337' }}>{total}</strong> · {pctOk}% OK
                      </span>
                    </div>
                    <div style={{ height: '6px', background: '#F5F5F5', borderRadius: '3px', display: 'flex', overflow: 'hidden', width: `${pct}%`, minWidth: '20px' }}>
                      <div style={{ flex: agg.ok, background: '#16a34a' }} />
                      <div style={{ flex: agg.ko, background: '#dc2626' }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Connexions clients + clients */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
            <div className="flex items-center gap-2 mb-4">
              <LogIn className="h-4 w-4" style={{ color: '#2563eb' }} />
              <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
                Connexions clients
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div style={{ background: '#F5F5F5', padding: '10px 12px', borderRadius: '8px' }}>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#585e6a', fontWeight: 600, textTransform: 'uppercase' }}>30 jours</p>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337' }}>{connexions30}</p>
              </div>
              <div style={{ background: '#F5F5F5', padding: '10px 12px', borderRadius: '8px' }}>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#585e6a', fontWeight: 600, textTransform: 'uppercase' }}>7 jours</p>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337' }}>{connexions7}</p>
              </div>
              <div style={{ background: '#DCFCE7', padding: '10px 12px', borderRadius: '8px' }}>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>Déjà connectés</p>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337' }}>{clientsConnectes}</p>
              </div>
              <div style={{ background: '#FEF3C7', padding: '10px 12px', borderRadius: '8px' }}>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#d97706', fontWeight: 600, textTransform: 'uppercase' }}>Jamais connectés</p>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337' }}>{clientsJamaisConnectes}</p>
              </div>
            </div>
            <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a', fontWeight: 600, marginBottom: '8px' }}>
              Dernières connexions
            </p>
            {dernieresConnexions.length === 0 ? (
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>Aucune connexion enregistrée.</p>
            ) : (
              <div className="space-y-2">
                {dernieresConnexions.map(c => (
                  <div key={c.id} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', fontWeight: 500 }} className="truncate">
                        {c.nom || c.email}
                      </p>
                      <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#585e6a' }} className="truncate">
                        {c.email}
                      </p>
                    </div>
                    <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }} className="flex-shrink-0 ml-3">
                      {formatDistanceToNow(new Date(c.last_sign_in_at!), { addSuffix: true, locale: fr })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-4 w-4" style={{ color: '#EE7D07' }} />
              <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
                Nouveaux dossiers clients
              </h2>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div style={{ background: '#FFF5EB', padding: '10px 12px', borderRadius: '8px' }}>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#EE7D07', fontWeight: 600, textTransform: 'uppercase' }}>Dossiers 30j</p>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337' }}>{dossiers30.count ?? 0}</p>
              </div>
              <div style={{ background: '#FFF5EB', padding: '10px 12px', borderRadius: '8px' }}>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#EE7D07', fontWeight: 600, textTransform: 'uppercase' }}>Dossiers 7j</p>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337' }}>{dossiers7.count ?? 0}</p>
              </div>
              <div style={{ background: '#EFF6FF', padding: '10px 12px', borderRadius: '8px' }}>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#2563eb', fontWeight: 600, textTransform: 'uppercase' }}>Clients 30j</p>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337' }}>{clients30.count ?? 0}</p>
              </div>
            </div>
            <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid #EBEBEB' }}>
              <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>Clients avec dossier</span>
              <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', fontWeight: 600 }}>
                {clientsAvecDossier} / {totalClients}
              </span>
            </div>
            <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid #EBEBEB' }}>
              <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>Clients sans dossier</span>
              <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
                {clientsSansDossier}
              </span>
            </div>
            <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid #EBEBEB' }}>
              <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>Dossiers financés</span>
              <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#16a34a', fontWeight: 600 }}>
                <FolderCheck className="h-3.5 w-3.5 inline mr-1" />
                {parStatut.finance}
              </span>
            </div>
            <div className="flex items-center justify-between py-2" style={{ borderTop: '1px solid #EBEBEB' }}>
              <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>Dossiers refusés</span>
              <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
                <FolderX className="h-3.5 w-3.5 inline mr-1" />
                {parStatut.refuse}
              </span>
            </div>
          </div>
        </div>

        {/* Derniers emails */}
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
          <div className="px-5 py-4" style={{ borderBottom: '1px solid #EBEBEB' }}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
              Derniers emails envoyés
            </h2>
          </div>
          {(emailsRecent.data ?? []).length === 0 ? (
            <div className="py-10 text-center">
              <Mail className="h-10 w-10 mx-auto mb-2" style={{ color: '#EBEBEB' }} />
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                Aucun email n'a été enregistré pour l'instant.
              </p>
            </div>
          ) : (
            (emailsRecent.data as any[]).map((e, idx, arr) => (
              <div key={e.id} className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: idx < arr.length - 1 ? '1px solid #EBEBEB' : 'none' }}>
                <div className="min-w-0 flex items-center gap-3">
                  {e.success
                    ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" style={{ color: '#16a34a' }} />
                    : <XCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#dc2626' }} />}
                  <div className="min-w-0">
                    <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', fontWeight: 600, color: '#112337' }} className="truncate">
                      {e.sujet || e.template_slug || 'Email'}
                    </p>
                    <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }} className="truncate">
                      → {e.destinataire} · {e.template_slug ?? '—'}
                      {e.erreur && <span style={{ color: '#dc2626' }}> · {e.erreur}</span>}
                    </p>
                  </div>
                </div>
                <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }} className="flex-shrink-0 ml-3">
                  {formatDistanceToNow(new Date(e.created_at), { addSuffix: true, locale: fr })}
                </span>
              </div>
            ))
          )}
        </div>

      </main>
    </div>
  )
}
