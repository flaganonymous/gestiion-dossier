'use client'

import { useState } from 'react'
import { Profile, ROLE_LABELS, UserRole } from '@/lib/supabase/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, UserCheck, UserX, Loader2, Users, Pencil, Trash2, Mail, CheckCircle2, AlertCircle } from 'lucide-react'

const ROLE_COLORS: Record<UserRole, { bg: string; color: string }> = {
  admin: { bg: '#EDE9FE', color: '#7C3AED' },
  collaborateur: { bg: '#FFF5EB', color: '#EE7D07' },
  client: { bg: '#F5F5F5', color: '#585e6a' },
}

type EditForm = { nom: string; prenom: string; email: string; role: UserRole }
type FlashKind = 'success' | 'error'

export function UsersClient({ initialUsers }: { initialUsers: Profile[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [createFlash, setCreateFlash] = useState<{ kind: FlashKind; msg: string } | null>(null)
  const [form, setForm] = useState({ email: '', password: '', nom: '', prenom: '', role: 'collaborateur' as UserRole })

  // Edit dialog state
  const [editUser, setEditUser] = useState<Profile | null>(null)
  const [editForm, setEditForm] = useState<EditForm>({ nom: '', prenom: '', email: '', role: 'client' })
  const [editError, setEditError] = useState('')
  const [editFlash, setEditFlash] = useState<{ kind: FlashKind; msg: string } | null>(null)

  // Delete confirm state
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCreateFlash(null)
    setLoading('create')

    // Pour un client, le mot de passe est defini via le lien d'invitation.
    const payload: Record<string, unknown> = {
      email: form.email, nom: form.nom, prenom: form.prenom, role: form.role,
    }
    if (form.role !== 'client') payload.password = form.password

    const res = await fetch('/api/admin/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setLoading(null); return }

    const listRes = await fetch('/api/admin/users')
    setUsers(await listRes.json())

    if (form.role === 'client') {
      const dossierNote = data.dossier_id ? ' · dossier cree' : (data.dossier_error ? ` · dossier non cree : ${data.dossier_error}` : '')
      if (data.email_sent) {
        setCreateFlash({ kind: 'success', msg: `Client cree, invitation envoyee${dossierNote}` })
      } else {
        setCreateFlash({ kind: 'error', msg: `Client cree mais email non envoye : ${data.email_error ?? 'raison inconnue'}${dossierNote}` })
      }
    } else {
      setCreateFlash({ kind: 'success', msg: 'Compte cree' })
    }

    setForm({ email: '', password: '', nom: '', prenom: '', role: 'collaborateur' })
    setLoading(null)
    // On ferme le dialog apres 1.5s pour laisser voir le feedback
    setTimeout(() => { setDialogOpen(false); setCreateFlash(null) }, 1800)
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

  function openEdit(user: Profile) {
    setEditUser(user)
    setEditForm({ nom: user.nom ?? '', prenom: user.prenom ?? '', email: user.email ?? '', role: user.role })
    setEditError('')
    setEditFlash(null)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setEditError('')
    setEditFlash(null)
    setLoading('edit_' + editUser.id)
    const body: Record<string, unknown> = {
      nom: editForm.nom.trim(),
      prenom: editForm.prenom.trim(),
      role: editForm.role,
    }
    if (editForm.email.trim().toLowerCase() !== editUser.email.toLowerCase()) {
      body.email = editForm.email.trim().toLowerCase()
    }
    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json()
    setLoading(null)
    if (!res.ok) { setEditError(data.error ?? 'Erreur'); return }

    setUsers(prev => prev.map(u => u.id === editUser.id ? {
      ...u,
      nom: editForm.nom.trim(),
      prenom: editForm.prenom.trim(),
      email: (body.email as string) ?? u.email,
      role: editForm.role,
    } : u))
    setEditFlash({ kind: 'success', msg: 'Modifications enregistrées' })
  }

  async function handleRenvoyerInvitation() {
    if (!editUser) return
    setEditError('')
    setEditFlash(null)
    setLoading('invite_' + editUser.id)
    const res = await fetch(`/api/admin/users/${editUser.id}/renvoyer-invitation`, { method: 'POST' })
    const data = await res.json()
    setLoading(null)
    if (!res.ok) { setEditError(data.error ?? 'Erreur'); return }
    if (data.email_sent) {
      setEditFlash({ kind: 'success', msg: 'Email d\'invitation renvoyé' })
    } else {
      setEditFlash({ kind: 'error', msg: `Token régénéré mais email non envoyé : ${data.email_error ?? 'raison inconnue'}` })
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setLoading('delete_' + confirmDelete.id)
    const res = await fetch(`/api/admin/users/${confirmDelete.id}`, { method: 'DELETE' })
    const data = res.ok ? null : await res.json().catch(() => ({ error: 'Erreur' }))
    setLoading(null)
    if (!res.ok) { setEditError(data?.error ?? 'Erreur'); return }
    setUsers(prev => prev.filter(u => u.id !== confirmDelete.id))
    setConfirmDelete(null)
    if (editUser?.id === confirmDelete.id) setEditUser(null)
  }

  const grouped: Record<UserRole, Profile[]> = {
    admin: users.filter(u => u.role === 'admin'),
    collaborateur: users.filter(u => u.role === 'collaborateur'),
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
              background: '#EE7D07', color: '#fff', border: 'none',
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
                  Rôle
                </label>
                <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #EBEBEB', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', outline: 'none', background: '#fff' }}
                >
                  <option value="admin">Administrateur</option>
                  <option value="collaborateur">Collaborateur</option>
                  <option value="client">Client</option>
                </select>
              </div>

              {form.role === 'client' ? (
                <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '10px 14px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#1e40af', display: 'flex', gap: '8px' }}>
                  <Mail className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>Un email d'invitation sera envoye automatiquement. Le client definira son mot de passe via le lien (valable 72h).</span>
                </div>
              ) : (
                <div>
                  <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                    Mot de passe temporaire
                  </label>
                  <input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    minLength={8} required
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #EBEBEB', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', outline: 'none' }}
                  />
                </div>
              )}

              {createFlash && (
                <div style={{
                  background: createFlash.kind === 'success' ? '#DCFCE7' : '#FEF2F2',
                  border: createFlash.kind === 'success' ? '1px solid #86EFAC' : '1px solid #FECACA',
                  borderRadius: '8px', padding: '10px 14px',
                  fontFamily: 'Open Sans, sans-serif', fontSize: '13px',
                  color: createFlash.kind === 'success' ? '#166534' : '#DC2626',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {createFlash.kind === 'success'
                    ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                  <span>{createFlash.msg}</span>
                </div>
              )}

              {error && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626' }}>
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading === 'create'}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: loading === 'create' ? '#F5B86C' : '#EE7D07', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: loading === 'create' ? 'not-allowed' : 'pointer' }}
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

                      <button
                        onClick={() => openEdit(user)}
                        title="Éditer"
                        style={{ padding: '7px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#F5F5F5', color: '#112337' }}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => setConfirmDelete(user)}
                        title="Supprimer"
                        style={{ padding: '7px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: '#FEF2F2', color: '#dc2626' }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Poppins, sans-serif', color: '#112337' }}>
              Éditer l'utilisateur
            </DialogTitle>
          </DialogHeader>
          {editUser && (
            <form onSubmit={handleEditSave} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                    Prénom
                  </label>
                  <input value={editForm.prenom} onChange={e => setEditForm(p => ({ ...p, prenom: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #EBEBEB', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                    Nom
                  </label>
                  <input value={editForm.nom} onChange={e => setEditForm(p => ({ ...p, nom: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #EBEBEB', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', outline: 'none' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                  Email
                </label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #EBEBEB', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                  Rôle
                </label>
                <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value as UserRole }))}
                  style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #EBEBEB', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#112337', outline: 'none', background: '#fff' }}
                >
                  <option value="admin">Administrateur</option>
                  <option value="collaborateur">Collaborateur</option>
                  <option value="client">Client</option>
                </select>
              </div>

              {editFlash && (
                <div style={{
                  background: editFlash.kind === 'success' ? '#DCFCE7' : '#FEF2F2',
                  border: editFlash.kind === 'success' ? '1px solid #86EFAC' : '1px solid #FECACA',
                  borderRadius: '8px', padding: '10px 14px',
                  fontFamily: 'Open Sans, sans-serif', fontSize: '13px',
                  color: editFlash.kind === 'success' ? '#166534' : '#DC2626',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {editFlash.kind === 'success'
                    ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
                  <span>{editFlash.msg}</span>
                </div>
              )}

              {editError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626' }}>
                  {editError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={loading === 'edit_' + editUser.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#EE7D07', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                >
                  {loading === 'edit_' + editUser.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  Enregistrer
                </button>
                {editUser.role === 'client' && (
                  <button type="button" onClick={handleRenvoyerInvitation} disabled={loading === 'invite_' + editUser.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#EFF6FF', color: '#2563eb', border: '1.5px solid #BFDBFE', borderRadius: '8px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                  >
                    {loading === 'invite_' + editUser.id
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Mail className="h-4 w-4" />}
                    Renvoyer l'invitation
                  </button>
                )}
                <button type="button" onClick={() => setEditUser(null)}
                  style={{ padding: '10px 20px', background: '#F5F5F5', color: '#112337', border: 'none', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '14px', cursor: 'pointer', marginLeft: 'auto' }}
                >
                  Fermer
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Poppins, sans-serif', color: '#112337' }}>
              Supprimer l'utilisateur ?
            </DialogTitle>
          </DialogHeader>
          {confirmDelete && (
            <div className="mt-2 space-y-4">
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#112337' }}>
                Tu es sur le point de supprimer définitivement{' '}
                <strong>{confirmDelete.prenom} {confirmDelete.nom}</strong> ({confirmDelete.email}).
              </p>
              <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', padding: '10px 14px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#92400E' }}>
                Cette action est irréversible. Les dossiers rattachés seront conservés mais leur lien vers ce client sera perdu.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={loading === 'delete_' + confirmDelete.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
                >
                  {loading === 'delete_' + confirmDelete.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                  Supprimer définitivement
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  style={{ padding: '10px 20px', background: '#F5F5F5', color: '#112337', border: 'none', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '14px', cursor: 'pointer' }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  )
}
