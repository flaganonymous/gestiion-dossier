'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { UploadZone } from '@/components/upload-zone'
import {
  Dossier, Document, HistoriqueStatut, Profile,
  STATUT_COLORS, STATUT_LABELS, DossierStatut
} from '@/lib/supabase/types'
import {
  ArrowLeft, FileText, Image, Download, Trash2,
  Clock, User, Calendar
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Props {
  dossier: Dossier & { client: any; apporteur: any }
  documents: (Document & { uploade_par_profile: any })[]
  historique: (HistoriqueStatut & { modifie_par_profile: any })[]
  profile: Profile
}

export function DossierDetail({ dossier, documents: initDocs, historique, profile }: Props) {
  const router = useRouter()
  const [documents, setDocuments] = useState(initDocs)
  const [statut, setStatut] = useState<DossierStatut>(dossier.statut)
  const [changingStatut, setChangingStatut] = useState(false)

  const canEdit = ['admin', 'collaborateur'].includes(profile.role)
  const canUpload = ['admin', 'collaborateur', 'apporteur', 'client'].includes(profile.role)

  async function handleStatutChange(newStatut: DossierStatut) {
    if (!canEdit) return
    setChangingStatut(true)
    const res = await fetch(`/api/dossiers/${dossier.id}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: newStatut }),
    })
    if (res.ok) {
      setStatut(newStatut)
      router.refresh()
    }
    setChangingStatut(false)
  }

  async function handleDownload(doc: Document) {
    const res = await fetch(`/api/documents/${doc.id}`)
    const { url } = await res.json()
    window.open(url, '_blank')
  }

  async function handleDelete(docId: string) {
    if (!confirm('Supprimer ce document ?')) return
    const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' })
    if (res.ok) {
      setDocuments(prev => prev.filter(d => d.id !== docId))
    }
  }

  async function reloadDocuments() {
    // Recharger la liste depuis le serveur
    router.refresh()
    // Optimiste : attendre un court délai puis refresh
    setTimeout(() => router.refresh(), 1000)
  }

  function getFileIcon(typeMime: string | null) {
    if (!typeMime) return <FileText className="h-5 w-5 text-gray-400" />
    if (typeMime.startsWith('image/')) return <Image className="h-5 w-5 text-blue-400" />
    if (typeMime === 'application/pdf') return <FileText className="h-5 w-5 text-red-400" />
    return <FileText className="h-5 w-5 text-gray-400" />
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
  }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href="/dossiers" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4 w-fit">
          <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{dossier.titre}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" /> {dossier.annee}
              </span>
              {dossier.client && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  Client : {dossier.client.prenom} {dossier.client.nom}
                </span>
              )}
              {dossier.apporteur && (
                <span className="flex items-center gap-1 hidden sm:flex">
                  <User className="h-4 w-4" />
                  Apporteur : {dossier.apporteur.prenom} {dossier.apporteur.nom}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canEdit ? (
              <Select
                value={statut}
                onValueChange={v => v && handleStatutChange(v as DossierStatut)}
                disabled={changingStatut}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="finance">Financé</SelectItem>
                  <SelectItem value="refuse">Refusé</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Badge className={`${STATUT_COLORS[statut]} text-sm px-3 py-1`}>
                {STATUT_LABELS[statut]}
              </Badge>
            )}
          </div>
        </div>

        {dossier.notes && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-900">
            {dossier.notes}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Documents */}
        <div className="lg:col-span-2 space-y-4">
          {canUpload && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ajouter des documents</CardTitle>
              </CardHeader>
              <CardContent>
                <UploadZone dossierId={dossier.id} onUploadComplete={reloadDocuments} />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Documents ({documents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <FileText className="h-10 w-10 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">Aucun document dans ce dossier</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 py-3">
                      {getFileIcon(doc.type_mime)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{doc.nom_fichier}</p>
                        <p className="text-xs text-gray-400">
                          {formatSize(doc.taille)}
                          {doc.uploade_par_profile && (
                            <> · {doc.uploade_par_profile.prenom} {doc.uploade_par_profile.nom}</>
                          )}
                          {' · '}
                          {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(doc)}
                          title="Télécharger"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(doc.id)}
                            className="text-red-400 hover:text-red-600 hover:bg-red-50"
                            title="Supprimer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Historique */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Historique
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historique.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Aucun changement de statut</p>
              ) : (
                <div className="space-y-3">
                  {historique.map(h => (
                    <div key={h.id} className="text-sm">
                      <div className="flex items-center gap-2">
                        {h.ancien_statut && (
                          <>
                            <Badge className={`${STATUT_COLORS[h.ancien_statut]} text-xs`}>
                              {STATUT_LABELS[h.ancien_statut]}
                            </Badge>
                            <span className="text-gray-400">→</span>
                          </>
                        )}
                        <Badge className={`${STATUT_COLORS[h.nouveau_statut]} text-xs`}>
                          {STATUT_LABELS[h.nouveau_statut]}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {h.modifie_par_profile
                          ? `${h.modifie_par_profile.prenom} ${h.modifie_par_profile.nom}`
                          : 'Système'}
                        {' · '}
                        {format(new Date(h.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                      </p>
                      <Separator className="mt-3" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
