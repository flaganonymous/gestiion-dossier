'use client'

import { useState } from 'react'
import { Profile, ROLE_LABELS, UserRole } from '@/lib/supabase/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, UserCheck, UserX, Loader2, Users } from 'lucide-react'

const ROLE_COLORS: Record<UserRole, { bg: string; color: string }> = {
  admin: { bg: '#EDE9FE', color: '#7C3AED' },
  collaborateur: { bg: '#EEF2FF', color: '#204ce5' },
  apporteur: { bg: '#DCFCE7', color: '#16a34a' },
  client: { bg: '#F5F5F5', color: '#585e6a' },
}

export function UsersClient({ initialUsers }: { initialUsers: Profile[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', password: '', nom: '', prenom: '', role: 'apporteur' as UserRole })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading('create')
    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(null); return }
    const listRes = await fetch('/api/admin/users')
    setUsers(await listRes.json())
    setForm({ email: '', password: '', nom: '', prenom: '', role: 'apporteur' })
    setDialogOpen(false)
    setLoading(null)
  }

  async function toggleActif(user: Profile) {
    setLoading(user.id)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actif: !user.actif }),
    })
    if (res.ok) setUsers(prev => prev.map(u => u.id === user.id ? { ...u, actif: !u.actif } : u))
    setLoading(null)
  }

  async function changeRole(userId: string, newRole: UserRole) {
    setLoading(userId + '_role')
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    setLoading(null)
  }

  const grouped: Record<UserRole, Profile[]> = {
    admin: users.filter(u => u.role === 'admin'),
    collaborateur: users.filter(u => u.role === 'collaborateur'),
    apporteur: users.filter(u => u.role === 'apporteur'),
    client: users.filter(u => u.role === 'client'),
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px', color: '#112337' }}>
            Utilisateurs
          </h1>
          <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#585e6a', marginTop: '2px' }}>
            {users.length} compte{users.length > 1 ? 's' : ''} enregistré{users.length > 1 ? 's' : ''}
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <button style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: '#204ce5', color: '#fff', border: 'none',
              padding: '10px 20px', borderRadius: '8px',
              fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
            }}>
              <Plus className="h-4 w-4" />
              Nouvel utilisateur
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'Poppins, sans-serif', color: '#112337' }}>
                Créer un compte utilisateur
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Prénom', key: 'prenom' as const, placeholder: 'Jean' },
                  { label: 'Nom', key: 'nom' as const, placeholder: 'Dupont' },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                      {f.label}
                    </label>
                    <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} required
                      style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #EBEBEB', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', outline: 'none' }}
                    />
                  </div>
                ))}
              </div>

              <div>
                <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                  Email
                </label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="jean.dupont@exemple.fr" required
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #EBEBEB', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                  Mot de passe temporaire
                </label>
                <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  minLength={8} required
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #EBEBEB', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                  Rôle
                </label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #EBEBEB', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', outline: 'none', background: '#fff' }}
                >
                  <option value="admin">Administrateur</option>
                  <option value="collaborateur">Collaborateur</option>
                  <option value="apporteur">Apporteur d'affaire</option>
                  <option value="client">Client</option>
                </select>
              </div>

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626' }}>
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading === 'create'}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: loading === 'create' ? '#93A3D4' : '#204ce5', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: loading === 'create' ? 'not-allowed' : 'pointer' }}
                >
                  {loading === 'create' && <Loader2 className="h-4 w-4 animate-spin" />}
                  Créer le compte
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

      {/* Groupes par rôle */}
      <div className="space-y-5">
        {(Object.entries(grouped) as [UserRole, Profile[]][]).map(([role, list]) =>
          list.length > 0 && (
            <div key={role} style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', overflow: 'hidden' }}>
              <div className="px-6 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #EBEBEB', background: '#FAFAFA' }}>
                <Users className="h-4 w-4" style={{ color: ROLE_COLORS[role].color }} />
                <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337' }}>
                  {ROLE_LABELS[role]}
                </span>
                <span style={{ background: ROLE_COLORS[role].bg, color: ROLE_COLORS[role].color, padding: '1px 8px', borderRadius: '12px', fontSize: '11px', fontFamily: 'Open Sans, sans-serif', fontWeight: 600 }}>
                  {list.length}
                </span>
              </div>
              <div>
                {list.map((user, idx) => (
                  <div key={user.id} className="flex items-center gap-3 px-6 py-4"
                    style={{ borderBottom: idx < list.length - 1 ? '1px solid #EBEBEB' : 'none' }}
                  >
                    <Avatar className="h-9 w-9 flex-shrink-0">
                      <AvatarFallback style={{ background: ROLE_COLORS[user.role].bg, color: ROLE_COLORS[user.role].color, fontSize: '12px', fontWeight: 700, fontFamily: 'Poppins, sans-serif' }}>
                        {user.prenom?.[0]}{user.nom?.[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337' }}>
                          {user.prenom} {user.nom}
                        </p>
                        {!user.actif && (
                          <span style={{ background: '#F5F5F5', color: '#585e6a', padding: '1px 8px', borderRadius: '12px', fontSize: '11px', fontFamily: 'Open Sans, sans-serif' }}>
                            Inactif
                          </span>
                        )}
                      </div>
                      <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>{user.email}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <select
                        value={user.role}
                        onChange={e => changeRole(user.id, e.target.value as UserRole)}
                        disabled={loading === user.id + '_role'}
                        style={{ padding: '6px 10px', border: '1.5px solid #EBEBEB', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#112337', outline: 'none', background: '#fff', cursor: 'pointer' }}
                      >
                        <option value="admin">Admin</option>
                        <option value="collaborateur">Collaborateur</option>
                        <option value="apporteur">Apporteur</option>
                        <option value="client">Client</option>
                      </select>

                      <button
                        onClick={() => toggleActif(user)}
                        disabled={loading === user.id}
                        title={user.actif ? 'Désactiver' : 'Activer'}
                        style={{
                          padding: '7px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                          background: user.actif ? '#FEF2F2' : '#DCFCE7',
                          color: user.actif ? '#dc2626' : '#16a34a',
                        }}
                      >
                        {loading === user.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : user.actif ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </main>
  )
}
