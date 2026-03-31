'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Profile } from '@/lib/supabase/types'
import { Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NouveauDossierPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [clients, setClients] = useState<Profile[]>([])
  const [apporteurs, setApporteurs] = useState<Profile[]>([])

  const [titre, setTitre] = useState('')
  const [annee, setAnnee] = useState(new Date().getFullYear())
  const [clientId, setClientId] = useState('')
  const [apporteurId, setApporteurId] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!p) return
      setProfile(p)

      // Admin et collaborateur voient tous les clients et apporteurs
      if (['admin', 'collaborateur'].includes(p.role)) {
        const { data: c } = await supabase.from('profiles').select('*').eq('role', 'client').eq('actif', true)
        const { data: a } = await supabase.from('profiles').select('*').eq('role', 'apporteur').eq('actif', true)
        setClients(c ?? [])
        setApporteurs(a ?? [])
      } else if (p.role === 'apporteur') {
        // Apporteur se définit lui-même
        setApporteurId(p.id)
        const { data: c } = await supabase.from('profiles').select('*').eq('role', 'client').eq('actif', true)
        setClients(c ?? [])
      }
    }
    load()
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
    }).select('id').single()

    if (err) {
      setError('Erreur lors de la création : ' + err.message)
      setLoading(false)
      return
    }

    router.push(`/dossiers/${data.id}`)
  }

  if (!profile) return null

  const annees = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i + 1)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar profile={profile} />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <Link href="/dossiers" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Nouveau dossier</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations du dossier</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="titre">Titre du dossier *</Label>
                <Input
                  id="titre"
                  value={titre}
                  onChange={e => setTitre(e.target.value)}
                  placeholder="Ex : Dupont Jean — Rachat crédit immobilier"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="annee">Année</Label>
                <Select value={String(annee)} onValueChange={v => v && setAnnee(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {annees.map(a => (
                      <SelectItem key={a} value={String(a)}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {clients.length > 0 && (
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={clientId} onValueChange={v => setClientId(v ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.prenom} {c.nom} — {c.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {apporteurs.length > 0 && (
                <div className="space-y-2">
                  <Label>Apporteur d'affaire</Label>
                  <Select value={apporteurId} onValueChange={v => setApporteurId(v ?? '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un apporteur..." />
                    </SelectTrigger>
                    <SelectContent>
                      {apporteurs.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.prenom} {a.nom}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="Informations complémentaires..."
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Créer le dossier
                </Button>
                <Link href="/dossiers">
                  <Button type="button" variant="outline">Annuler</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
