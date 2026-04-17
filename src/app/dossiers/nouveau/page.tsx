'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/navbar'
import { Profile, Apporteur } from '@/lib/supabase/types'
import { SITUATION_LOGEMENT_LABELS, SITUATION_PROFESSIONNELLE_LABELS } from '@/lib/documents-checklist'
import { Loader2, ArrowLeft, FolderPlus, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export default function NouveauDossierPage() {
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [clients, setClients] = useState<Profile[]>([])
  const [apporteurs, setApporteurs] = useState<Apporteur[]>([])

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

  // Création client inline
  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [newClient, setNewClient] = useState({ prenom: '', nom: '', email: '' })
  const [creatingClient, setCreatingClient] = useState(false)
  const [clientError, setClientError] = useState('')

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault()
    setClientError('')
    setCreatingClient(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      })
      const data = await res.json()
      if (!res.ok) { setClientError(data.error || 'Erreur'); return }
      setClients(prev => {
        if (prev.some(c => c.id === data.client.id)) return prev
        return [...prev, data.client as Profile]
      })
      setClientId(data.client.id)
      setNewClient({ prenom: '', nom: '', email: '' })
      setClientDialogOpen(false)
    } finally {
      setCreatingClient(false)
    }
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : Promise.reject('Not authenticated'))
      .then(data => {
        setProfile(data.profile)
        setClients(data.clients)
        setApporteurs(data.apporteurs)
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

            <div>
              <label style={labelStyle}>Client</label>
              <div className="flex gap-2">
                <select value={clientId} onChange={e => setClientId(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
                  <option value="">Sélectionner un client...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.email}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => { setClientError(''); setClientDialogOpen(true) }}
                  title="Créer un client"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '10px 14px', background: '#FFF5EB', color: '#EE7D07',
                    border: '1.5px solid #EBEBEB', borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  <UserPlus className="h-4 w-4" />
                  Nouveau
                </button>
              </div>
            </div>

            <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle style={{ fontFamily: 'Poppins, sans-serif', color: '#112337' }}>
                    Nouveau client
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateClient} className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>Prénom *</label>
                      <input
                        value={newClient.prenom}
                        onChange={e => setNewClient(p => ({ ...p, prenom: e.target.value }))}
                        required style={inputStyle} placeholder="Jean"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Nom *</label>
                      <input
                        value={newClient.nom}
                        onChange={e => setNewClient(p => ({ ...p, nom: e.target.value }))}
                        required style={inputStyle} placeholder="Dupont"
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Email *</label>
                    <input
                      type="email"
                      value={newClient.email}
                      onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))}
                      required style={inputStyle} placeholder="jean.dupont@exemple.fr"
                    />
                    <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a', marginTop: '6px' }}>
                      Un email d&apos;invitation sera envoyé au client pour activer son compte.
                    </p>
                  </div>

                  {clientError && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626' }}>
                      {clientError}
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button type="submit" disabled={creatingClient}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: creatingClient ? '#F5B86C' : '#EE7D07', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: creatingClient ? 'not-allowed' : 'pointer' }}
                    >
                      {creatingClient && <Loader2 className="h-4 w-4 animate-spin" />}
                      Créer le client
                    </button>
                    <button type="button" onClick={() => setClientDialogOpen(false)}
                      style={{ padding: '10px 20px', background: '#F5F5F5', color: '#112337', border: 'none', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '14px', cursor: 'pointer' }}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>

            {apporteurs.length > 0 && (
              <div>
                <label style={labelStyle}>Apporteur d&apos;affaires (optionnel)</label>
                <select value={apporteurId} onChange={e => setApporteurId(e.target.value)} style={inputStyle}>
                  <option value="">Aucun apporteur</option>
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
