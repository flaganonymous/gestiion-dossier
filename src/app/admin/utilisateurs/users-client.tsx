'use client'

import { useState } from 'react'
import { Profile, ROLE_LABELS, UserRole } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Plus, UserCheck, UserX, Loader2 } from 'lucide-react'

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-purple-100 text-purple-800',
  collaborateur: 'bg-blue-100 text-blue-800',
  apporteur: 'bg-green-100 text-green-800',
  client: 'bg-gray-100 text-gray-800',
}

export function UsersClient({ initialUsers }: { initialUsers: Profile[] }) {
  const [users, setUsers] = useState(initialUsers)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Formulaire nouveau user
  const [form, setForm] = useState({
    email: '', password: '', nom: '', prenom: '',
    role: 'apporteur' as UserRole,
  })

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading('create')

    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setLoading(null)
      return
    }

    // Recharger la liste
    const listRes = await fetch('/api/admin/users')
    const updatedUsers = await listRes.json()
    setUsers(updatedUsers)

    setForm({ email: '', password: '', nom: '', prenom: '', role: 'apporteur' })
    setDialogOpen(false)
    setLoading(null)
  }

  async function toggleActif(user: Profile) {
    setLoading(user.id)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actif: !user.actif }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, actif: !u.actif } : u))
    }
    setLoading(null)
  }

  async function changeRole(userId: string, newRole: UserRole) {
    setLoading(userId + '_role')
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    }
    setLoading(null)
  }

  const grouped = {
    admin: users.filter(u => u.role === 'admin'),
    collaborateur: users.filter(u => u.role === 'collaborateur'),
    apporteur: users.filter(u => u.role === 'apporteur'),
    client: users.filter(u => u.role === 'client'),
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} utilisateur{users.length > 1 ? 's' : ''}</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouvel utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un compte utilisateur</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom</Label>
                  <Input
                    value={form.prenom}
                    onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input
                    value={form.nom}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Mot de passe temporaire</Label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  minLength={8}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select value={form.role} onValueChange={v => v && setForm(f => ({ ...f, role: v as UserRole }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="collaborateur">Collaborateur</SelectItem>
                    <SelectItem value="apporteur">Apporteur d'affaire</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading === 'create'}>
                  {loading === 'create' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer le compte
                </Button>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {(Object.entries(grouped) as [UserRole, Profile[]][]).map(([role, list]) => (
          list.length > 0 && (
            <Card key={role}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  {ROLE_LABELS[role]} ({list.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-gray-100">
                  {list.map(user => (
                    <div key={user.id} className="flex items-center gap-3 py-3">
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarFallback className="bg-gray-100 text-gray-600 text-xs font-semibold">
                          {user.prenom[0]}{user.nom[0]}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900 text-sm">
                            {user.prenom} {user.nom}
                          </p>
                          {!user.actif && (
                            <Badge variant="outline" className="text-xs text-gray-400">Inactif</Badge>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Select
                          value={user.role}
                          onValueChange={v => v && changeRole(user.id, v as UserRole)}
                          disabled={loading === user.id + '_role'}
                        >
                          <SelectTrigger className="h-8 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="collaborateur">Collaborateur</SelectItem>
                            <SelectItem value="apporteur">Apporteur</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActif(user)}
                          disabled={loading === user.id}
                          title={user.actif ? 'Désactiver' : 'Activer'}
                          className={user.actif ? 'text-red-400 hover:text-red-600' : 'text-green-500 hover:text-green-700'}
                        >
                          {loading === user.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : user.actif
                            ? <UserX className="h-4 w-4" />
                            : <UserCheck className="h-4 w-4" />
                          }
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        ))}
      </div>
    </main>
  )
}
