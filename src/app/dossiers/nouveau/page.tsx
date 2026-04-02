'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/navbar'
import { Profile } from '@/lib/supabase/types'
import { SITUATION_LOGEMENT_LABELS, SITUATION_PROFESSIONNELLE_LABELS } from '@/lib/documents-checklist'
import { Loader2, ArrowLeft, FolderPlus } from 'lucide-react'
import Link from 'next/link'

export default function NouveauDossierPage() {
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [clients, setClients] = useState<Profile[]>([])
  const [apporteurs, setApporteurs] = useState<Profile[]>([])

  const [titre, setTitre] = useState('')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [clientId, setClientId] = useState('')
  const [apporteurId, setApporteurId] = useState('')
  const [notes, setNotes] = useState('')
  const [empruntADeux, setEmpruntADeux] = useState(false)
  const [situationLogement, setSituationLogement] = useState<string>('locataire')
  const [situationProfessionnelle, setSituationProfessionnelle] = useState<string>('salarie')
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : Promise.reject('Not authenticated'))
      .then(data => {
        setProfile(data.profile)
        setClients(data.clients)
        setApporteurs(data.apporteurs)
        if (data.profile.role === 'apporteur') setApporteurId(data.profile.id)
      })
      .catch(() => { window.location.href = '/login' })
      .finally(() => setPageLoading(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!titre.trim()) { setError('Le titre est requis.'); return }
    setError('')
    setLoading(true)

    const { data, error: err } = await supabase.from('dossiers').insert({
      titre: titre.trim(),
      annee,
      statut: 'en_cours',
      client_id: clientId || null,
      apporteur_id: apporteurId || null,
      notes: notes.trim() || null,
      situation_logement: situationLogement,
      situation_professionnelle: situationProfessionnelle,
      emprunt_a_deux: empruntADeux,
    }).select('id').single()

    if (err) {
      setError('Erreur lors de la création : ' + err.message)
      setLoading(false)
      return
    }

    window.location.href = `/dossiers/${data.id}`
  }

  if (pageLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#EE7D07' }} />
      </div>
    )
  }

  if (!profile) return null

  const annees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i + 1)

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid #EBEBEB', borderRadius: '8px',
    fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#112337',
    outline: 'none', transition: 'border-color 0.2s',
    background: '#fff',
  } as const

  const labelStyle = {
    fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px',
    color: '#112337', display: 'block', marginBottom: '6px',
  } as const

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <Navbar profile={profile} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link href="/dossiers" className="flex items-center gap-1 mb-4" style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
            <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
          </Link>
          <div className="flex items-center gap-3">
            <div style={{ background: '#FFF5EB', borderRadius: '10px' }} className="w-10 h-10 flex items-center justify-center">
              <FolderPlus className="h-5 w-5" style={{ color: '#EE7D07' }} />
            </div>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px', color: '#112337' }}>
              Nouveau dossier
            </h1>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', padding: '32px' }}>
          <form onSubmit={handleSubmit} className="space-y-5">

            <div>
              <label style={labelStyle}>Titre du dossier *</label>
              <input
                value={titre}
                onChange={e => setTitre(e.target.value)}
                placeholder="Ex : Dupont Jean — Rachat crédit immobilier"
                required
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#EE7D07'}
                onBlur={e => e.target.style.borderColor = '#EBEBEB'}
              />
            </div>

            <div>
              <label style={labelStyle}>Année</label>
              <select
                value={annee}
                onChange={e => setAnnee(parseInt(e.target.value))}
                style={inputStyle}
              >
                {annees.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {clients.length > 0 && (
              <div>
                <label style={labelStyle}>Client</label>
                <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                  <option value="">Sélectionner un client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.email}</option>
                  ))}
                </select>
              </div>
            )}

            {apporteurs.length > 0 && profile.role !== 'apporteur' && (
              <div>
                <label style={labelStyle}>Apporteur d'affaire</label>
                <select value={apporteurId} onChange={e => setApporteurId(e.target.value)} style={inputStyle}>
                  <option value="">Sélectionner un apporteur...</option>
                  {apporteurs.map(a => (
                    <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={labelStyle}>Notes (optionnel)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Informations complémentaires..."
                style={{ ...inputStyle, resize: 'none' as const }}
                onFocus={e => e.target.style.borderColor = '#EE7D07'}
                onBlur={e => e.target.style.borderColor = '#EBEBEB'}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="empruntADeux"
                checked={empruntADeux}
                onChange={e => setEmpruntADeux(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#EE7D07' }}
              />
              <label htmlFor="empruntADeux" style={labelStyle}>
                Emprunt à deux (les documents seront à fournir par les deux emprunteurs)
              </label>
            </div>

            <div>
              <label style={labelStyle}>Situation logement</label>
              <select
                value={situationLogement}
                onChange={e => setSituationLogement(e.target.value)}
                style={inputStyle}
              >
                {Object.entries(SITUATION_LOGEMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Situation professionnelle</label>
              <select
                value={situationProfessionnelle}
                onChange={e => setSituationProfessionnelle(e.target.value)}
                style={inputStyle}
              >
                {Object.entries(SITUATION_PROFESSIONNELLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626' }}>
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: loading ? '#F5B86C' : '#EE7D07', color: '#fff', border: 'none',
                  padding: '10px 24px', borderRadius: '8px',
                  fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Créer le dossier
              </button>
              <Link href="/dossiers">
                <button
                  type="button"
                  style={{
                    background: '#fff', color: '#585e6a', border: '1.5px solid #EBEBEB',
                    padding: '10px 24px', borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Annuler
                </button>
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
