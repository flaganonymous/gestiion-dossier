'use client'

import { useState } from 'react'
import { Apporteur } from '@/lib/supabase/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, UserCheck, UserX, Loader2, Users, Pencil, Trash2 } from 'lucide-react'

type FormState = { nom: string; prenom: string; email: string; telephone: string }
const EMPTY: FormState = { nom: '', prenom: '', email: '', telephone: '' }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1.5px solid #EBEBEB', borderRadius: '8px',
  fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', outline: 'none',
}

const labelStyle: React.CSSProperties = {
  fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px',
  color: '#112337', display: 'block', marginBottom: '6px',
}

export function ApporteursClient({ initial }: { initial: Apporteur[] }) {
  const [list, setList] = useState<Apporteur[]>(initial)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Apporteur | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  function openCreate() {
    setEditing(null)
    setForm(EMPTY)
    setError('')
    setDialogOpen(true)
  }

  function openEdit(a: Apporteur) {
    setEditing(a)
    setForm({ nom: a.nom, prenom: a.prenom, email: a.email ?? '', telephone: a.telephone ?? '' })
    setError('')
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading('submit')

    const url = editing ? `/api/admin/apporteurs/${editing.id}` : '/api/admin/apporteurs'
    const method = editing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Erreur'); setLoading(null); return }

    if (editing) {
      setList(prev => prev.map(a => a.id === data.id ? data : a))
    } else {
      setList(prev => [...prev, data].sort((a, b) => a.nom.localeCompare(b.nom)))
    }
    setDialogOpen(false)
    setLoading(null)
  }

  async function toggleActif(a: Apporteur) {
    setLoading(a.id)
    const res = await fetch(`/api/admin/apporteurs/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: !a.actif }),
    })
    if (res.ok) {
      const updated = await res.json()
      setList(prev => prev.map(x => x.id === a.id ? updated : x))
    }
    setLoading(null)
  }

  async function handleDelete(a: Apporteur) {
    if (!confirm(`Supprimer ${a.prenom} ${a.nom} ?`)) return
    setLoading(a.id)
    const res = await fetch(`/api/admin/apporteurs/${a.id}`, { method: 'DELETE' })
    if (res.ok) setList(prev => prev.filter(x => x.id !== a.id))
    else {
      const data = await res.json()
      alert(data.error || 'Erreur — cet apporteur est peut-être référencé par un dossier.')
    }
    setLoading(null)
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px', color: '#112337' }}>
            Apporteurs d&apos;affaires
          </h1>
          <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#585e6a', marginTop: '2px' }}>
            {list.length} apporteur{list.length > 1 ? 's' : ''} référencé{list.length > 1 ? 's' : ''}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null) }}>
          <DialogTrigger>
            <button
              onClick={openCreate}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: '#EE7D07', color: '#fff', border: 'none',
                padding: '10px 20px', borderRadius: '8px',
                fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
              }}
            >
              <Plus className="h-4 w-4" />
              Nouvel apporteur
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'Poppins, sans-serif', color: '#112337' }}>
                {editing ? 'Modifier l\'apporteur' : 'Nouvel apporteur'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Prénom *</label>
                  <input value={form.prenom} onChange={e => setForm(p => ({ ...p, prenom: e.target.value }))}
                    placeholder="Jean" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Nom *</label>
                  <input value={form.nom} onChange={e => setForm(p => ({ ...p, nom: e.target.value }))}
                    placeholder="Dupont" required style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Email (optionnel)</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="contact@exemple.fr" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Téléphone (optionnel)</label>
                <input value={form.telephone} onChange={e => setForm(p => ({ ...p, telephone: e.target.value }))}
                  placeholder="06 12 34 56 78" style={inputStyle} />
              </div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626' }}>
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading === 'submit'}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: loading === 'submit' ? '#F5B86C' : '#EE7D07', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: loading === 'submit' ? 'not-allowed' : 'pointer' }}
                >
                  {loading === 'submit' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editing ? 'Enregistrer' : 'Créer'}
                </button>
                <button type="button" onClick={() => setDialogOpen(false)}
                  style={{ padding: '10px 20px', background: '#F5F5F5', color: '#112337', border: 'none', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '14px', cursor: 'pointer' }}
                >
                  Annuler
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', padding: '48px', textAlign: 'center' }}>
          <Users className="h-10 w-10 mx-auto mb-3" style={{ color: '#EE7D07' }} />
          <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337', marginBottom: '4px' }}>
            Aucun apporteur
          </p>
          <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
            Ajoutez votre premier apporteur d&apos;affaires.
          </p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', overflow: 'hidden' }}>
          {list.map((a, idx) => (
            <div key={a.id} className="flex items-center gap-3 px-6 py-4"
              style={{ borderBottom: idx < list.length - 1 ? '1px solid #EBEBEB' : 'none' }}
            >
              <Avatar className="h-9 w-9 flex-shrink-0">
                <AvatarFallback style={{ background: '#FFF5EB', color: '#EE7D07', fontSize: '12px', fontWeight: 700, fontFamily: 'Poppins, sans-serif' }}>
                  {a.prenom?.[0]}{a.nom?.[0]}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337' }}>
                    {a.prenom} {a.nom}
                  </p>
                  {!a.actif && (
                    <span style={{ background: '#F5F5F5', color: '#585e6a', padding: '1px 8px', borderRadius: '12px', fontSize: '11px', fontFamily: 'Open Sans, sans-serif' }}>
                      Inactif
                    </span>
                  )}
                </div>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
                  {[a.email, a.telephone].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => openEdit(a)} title="Modifier"
                  style={{ padding: '7px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#F5F5F5', color: '#585e6a' }}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => toggleActif(a)}
                  disabled={loading === a.id}
                  title={a.actif ? 'Désactiver' : 'Activer'}
                  style={{
                    padding: '7px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                    background: a.actif ? '#FEF2F2' : '#DCFCE7',
                    color: a.actif ? '#dc2626' : '#16a34a',
                  }}
                >
                  {loading === a.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : a.actif ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                </button>
                <button onClick={() => handleDelete(a)} title="Supprimer"
                  style={{ padding: '7px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#FEF2F2', color: '#dc2626' }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
