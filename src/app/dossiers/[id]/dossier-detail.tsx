'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UploadZone } from '@/components/upload-zone'
import { Dossier, Document, HistoriqueStatut, Profile, STATUT_LABELS, DossierStatut, Apporteur } from '@/lib/supabase/types'
import { ArrowLeft, FileText, ImageIcon, Download, Trash2, Clock, User, Calendar, ChevronDown, Pencil, Save, X, CheckCircle2, Circle, Eye, Home, UserRound, Landmark, CreditCard, Briefcase, ChevronRight, Upload } from 'lucide-react'
import { SITUATION_LOGEMENT_LABELS, SITUATION_PROFESSIONNELLE_LABELS, CATEGORIES_DOCUMENTS, getDocumentsRequis, type SituationLogement, type SituationProfessionnelle } from '@/lib/documents-checklist'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const STATUT_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  en_cours: { bg: '#FFF5EB', color: '#EE7D07', label: 'En cours' },
  finance: { bg: '#DCFCE7', color: '#16a34a', label: 'Financé' },
  refuse: { bg: '#FEF2F2', color: '#dc2626', label: 'Refusé' },
}

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
  const [showStatutMenu, setShowStatutMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitre, setEditTitre] = useState(dossier.titre)
  const [editNotes, setEditNotes] = useState(dossier.notes ?? '')
  const [editSituationLogement, setEditSituationLogement] = useState<string>(dossier.situation_logement ?? 'locataire')
  const [editSituationProfessionnelle, setEditSituationProfessionnelle] = useState<string>(dossier.situation_professionnelle ?? 'salarie')
  const [editEmpruntADeux, setEditEmpruntADeux] = useState(dossier.emprunt_a_deux ?? false)
  const [editApporteurId, setEditApporteurId] = useState<string>(dossier.apporteur_id ?? '')
  const [editAnnee, setEditAnnee] = useState<string>(String(dossier.annee))
  const [apporteurs, setApporteurs] = useState<Apporteur[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const canEdit = ['admin', 'collaborateur'].includes(profile.role)
  const canUpload = ['admin', 'collaborateur', 'client'].includes(profile.role)
  const badge = STATUT_BADGE[statut] ?? STATUT_BADGE.en_cours

  useEffect(() => {
    if (!canEdit) return
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.apporteurs) setApporteurs(data.apporteurs) })
      .catch(() => {})
  }, [canEdit])

  async function refreshDocuments() {
    const res = await fetch(`/api/dossiers/${dossier.id}/documents`)
    if (res.ok) {
      const data = await res.json()
      setDocuments(data.documents)
    }
  }

  async function handleStatutChange(newStatut: DossierStatut) {
    if (!canEdit) return
    setChangingStatut(true)
    setShowStatutMenu(false)
    const res = await fetch(`/api/dossiers/${dossier.id}/statut`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statut: newStatut }),
    })
    if (res.ok) { setStatut(newStatut); router.refresh() }
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
    if (res.ok) setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  async function handlePreview(doc: Document) {
    const res = await fetch(`/api/documents/${doc.id}?preview=1`)
    if (!res.ok) return
    const { url } = await res.json()
    setPreviewUrl(url)
    setPreviewDoc(doc)
  }

  async function handleSave() {
    const anneeNum = Number(editAnnee)
    if (!Number.isInteger(anneeNum) || anneeNum < 1900 || anneeNum > 2100) {
      alert('Année invalide (doit être un entier entre 1900 et 2100)')
      return
    }
    setSaving(true)
    const res = await fetch(`/api/dossiers/${dossier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        titre: editTitre,
        notes: editNotes || null,
        situation_logement: editSituationLogement,
        situation_professionnelle: editSituationProfessionnelle,
        emprunt_a_deux: editEmpruntADeux,
        apporteur_id: editApporteurId || null,
        annee: anneeNum,
      }),
    })
    if (res.ok) {
      setEditing(false)
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Erreur lors de l\'enregistrement')
    }
    setSaving(false)
  }

  async function handleDeleteDossier() {
    if (!confirm(`Supprimer définitivement le dossier « ${dossier.titre} » ?\n\nCette action supprimera aussi tous les documents associés et ne peut pas être annulée.`)) return
    setDeleting(true)
    const res = await fetch(`/api/dossiers/${dossier.id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/dossiers')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Erreur lors de la suppression')
      setDeleting(false)
    }
  }

  const editInputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid #EBEBEB', borderRadius: '8px',
    fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#112337',
    outline: 'none', transition: 'border-color 0.2s',
    background: '#fff',
  } as const

  const editLabelStyle = {
    fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px',
    color: '#112337', display: 'block', marginBottom: '6px',
  } as const

  function getFileIcon(typeMime: string | null) {
    if (typeMime?.startsWith('image/')) return <ImageIcon className="h-5 w-5" style={{ color: '#EE7D07' }} />
    return <FileText className="h-5 w-5" style={{ color: '#dd9933' }} />
  }

  function formatSize(bytes: number | null) {
    if (!bytes) return ''
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Breadcrumb */}
      <Link href="/dossiers" className="flex items-center gap-1 w-fit mb-6" style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
        <ArrowLeft className="h-4 w-4" /> Retour aux dossiers
      </Link>

      {/* Header dossier */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '24px 28px', marginBottom: '20px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
        {editing ? (
          /* ---- Edit mode ---- */
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 mb-2">
              <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px', color: '#112337' }}>
                Modifier le dossier
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: saving ? '#F5B86C' : '#EE7D07', color: '#fff', border: 'none',
                    padding: '8px 16px', borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => {
                    setEditing(false)
                    setEditTitre(dossier.titre)
                    setEditNotes(dossier.notes ?? '')
                    setEditSituationLogement(dossier.situation_logement ?? 'locataire')
                    setEditSituationProfessionnelle(dossier.situation_professionnelle ?? 'salarie')
                    setEditEmpruntADeux(dossier.emprunt_a_deux ?? false)
                    setEditApporteurId(dossier.apporteur_id ?? '')
                    setEditAnnee(String(dossier.annee))
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: '#fff', color: '#585e6a', border: '1.5px solid #EBEBEB',
                    padding: '8px 16px', borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  <X className="h-4 w-4" />
                  Annuler
                </button>
              </div>
            </div>

            <div>
              <label style={editLabelStyle}>Titre du dossier</label>
              <input
                value={editTitre}
                onChange={e => setEditTitre(e.target.value)}
                style={editInputStyle}
                onFocus={e => e.target.style.borderColor = '#EE7D07'}
                onBlur={e => e.target.style.borderColor = '#EBEBEB'}
              />
            </div>

            <div>
              <label style={editLabelStyle}>Année du dossier</label>
              <input
                type="number"
                min={1900}
                max={2100}
                step={1}
                value={editAnnee}
                onChange={e => setEditAnnee(e.target.value)}
                style={editInputStyle}
                onFocus={e => e.target.style.borderColor = '#EE7D07'}
                onBlur={e => e.target.style.borderColor = '#EBEBEB'}
              />
            </div>

            <div>
              <label style={editLabelStyle}>Notes</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Informations complémentaires..."
                style={{ ...editInputStyle, resize: 'none' as const }}
                onFocus={e => e.target.style.borderColor = '#EE7D07'}
                onBlur={e => e.target.style.borderColor = '#EBEBEB'}
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="editEmpruntADeux"
                checked={editEmpruntADeux}
                onChange={e => setEditEmpruntADeux(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#EE7D07' }}
              />
              <label htmlFor="editEmpruntADeux" style={editLabelStyle}>
                Emprunt à deux (les documents seront à fournir par les deux emprunteurs)
              </label>
            </div>

            <div>
              <label style={editLabelStyle}>Situation logement</label>
              <select
                value={editSituationLogement}
                onChange={e => setEditSituationLogement(e.target.value)}
                style={editInputStyle}
              >
                {Object.entries(SITUATION_LOGEMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={editLabelStyle}>Situation professionnelle</label>
              <select
                value={editSituationProfessionnelle}
                onChange={e => setEditSituationProfessionnelle(e.target.value)}
                style={editInputStyle}
              >
                {Object.entries(SITUATION_PROFESSIONNELLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={editLabelStyle}>Apporteur d&apos;affaires</label>
              <select
                value={editApporteurId}
                onChange={e => setEditApporteurId(e.target.value)}
                style={editInputStyle}
              >
                <option value="">Aucun apporteur</option>
                {apporteurs.map(a => (
                  <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>
                ))}
                {dossier.apporteur && !apporteurs.some(a => a.id === dossier.apporteur_id) && (
                  <option value={dossier.apporteur.id}>
                    {dossier.apporteur.prenom} {dossier.apporteur.nom} (inactif)
                  </option>
                )}
              </select>
            </div>

            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #EBEBEB' }}>
              <button
                type="button"
                onClick={handleDeleteDossier}
                disabled={deleting}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: '#fff', color: '#dc2626', border: '1.5px solid #FECACA',
                  padding: '8px 16px', borderRadius: '8px',
                  fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
                  cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
                }}
              >
                <Trash2 className="h-4 w-4" />
                {deleting ? 'Suppression...' : 'Supprimer le dossier'}
              </button>
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a', marginTop: '8px' }}>
                Supprime définitivement le dossier et tous ses documents. Cette action ne peut pas être annulée.
              </p>
            </div>
          </div>
        ) : (
          /* ---- Read-only mode ---- */
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '22px', color: '#112337', marginBottom: '10px' }}>
                  {dossier.titre}
                </h1>
                <div className="flex flex-wrap gap-4">
                  <span className="flex items-center gap-1.5" style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                    <Calendar className="h-4 w-4" style={{ color: '#EE7D07' }} /> {dossier.annee}
                  </span>
                  {dossier.client && (
                    <span className="flex items-center gap-1.5" style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                      <User className="h-4 w-4" style={{ color: '#EE7D07' }} />
                      Client : {dossier.client.prenom} {dossier.client.nom}
                    </span>
                  )}
                  {dossier.apporteur && (
                    <span className="flex items-center gap-1.5 hidden sm:flex" style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                      <User className="h-4 w-4" style={{ color: '#585e6a' }} />
                      Apporteur : {dossier.apporteur.prenom} {dossier.apporteur.nom}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Edit button */}
                {canEdit && (
                  <button
                    onClick={() => setEditing(true)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      background: '#fff', color: '#EE7D07', border: '1.5px solid #EE7D07',
                      padding: '8px 16px', borderRadius: '8px',
                      fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Éditer
                  </button>
                )}

                {/* Statut */}
                <div className="relative">
                  {canEdit ? (
                    <>
                      <button
                        onClick={() => setShowStatutMenu(!showStatutMenu)}
                        disabled={changingStatut}
                        className="flex items-center gap-2"
                        style={{
                          background: badge.bg, color: badge.color,
                          border: `1.5px solid ${badge.color}30`,
                          padding: '8px 16px', borderRadius: '8px',
                          fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
                          cursor: 'pointer',
                        }}
                      >
                        {badge.label}
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      {showStatutMenu && (
                        <div style={{
                          position: 'absolute', right: 0, top: '44px', zIndex: 10,
                          background: '#fff', borderRadius: '10px', border: '1px solid #EBEBEB',
                          boxShadow: '0 8px 24px rgba(17,35,55,0.12)', overflow: 'hidden', minWidth: '160px',
                        }}>
                          {(['en_cours', 'finance', 'refuse'] as DossierStatut[]).map(s => {
                            const b = STATUT_BADGE[s]
                            return (
                              <button key={s} onClick={() => handleStatutChange(s)}
                                style={{
                                  display: 'block', width: '100%', textAlign: 'left',
                                  padding: '10px 16px', border: 'none', background: s === statut ? b.bg : '#fff',
                                  fontFamily: 'Open Sans, sans-serif', fontSize: '13px',
                                  color: s === statut ? b.color : '#112337',
                                  fontWeight: s === statut ? 600 : 400, cursor: 'pointer',
                                }}
                              >
                                {b.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{
                      background: badge.bg, color: badge.color,
                      padding: '8px 16px', borderRadius: '8px',
                      fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px',
                    }}>
                      {badge.label}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Situation info display */}
            {(dossier.situation_logement || dossier.situation_professionnelle || dossier.emprunt_a_deux) && (
              <div className="flex flex-wrap gap-3" style={{ marginTop: '12px' }}>
                {dossier.situation_logement && (
                  <span style={{
                    background: '#F0F9FF', color: '#0369A1', padding: '4px 12px', borderRadius: '16px',
                    fontFamily: 'Open Sans, sans-serif', fontSize: '12px', fontWeight: 600,
                  }}>
                    {SITUATION_LOGEMENT_LABELS[dossier.situation_logement as keyof typeof SITUATION_LOGEMENT_LABELS] ?? dossier.situation_logement}
                  </span>
                )}
                {dossier.situation_professionnelle && (
                  <span style={{
                    background: '#FDF4FF', color: '#7E22CE', padding: '4px 12px', borderRadius: '16px',
                    fontFamily: 'Open Sans, sans-serif', fontSize: '12px', fontWeight: 600,
                  }}>
                    {SITUATION_PROFESSIONNELLE_LABELS[dossier.situation_professionnelle as keyof typeof SITUATION_PROFESSIONNELLE_LABELS] ?? dossier.situation_professionnelle}
                  </span>
                )}
                {dossier.emprunt_a_deux && (
                  <span style={{
                    background: '#ECFDF5', color: '#065F46', padding: '4px 12px', borderRadius: '16px',
                    fontFamily: 'Open Sans, sans-serif', fontSize: '12px', fontWeight: 600,
                  }}>
                    Emprunt à deux
                  </span>
                )}
              </div>
            )}

            {dossier.notes && (
              <div style={{ marginTop: '16px', padding: '12px 16px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#92400E' }}>
                {dossier.notes}
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Documents */}
        <div className="lg:col-span-2 space-y-5">

          {/* Checklist catégorisée (si situations définies) */}
          {dossier.situation_logement && dossier.situation_professionnelle ? (
            <DocumentChecklist
              dossier={dossier}
              documents={documents}
              canUpload={canUpload}
              canEdit={canEdit}
              onDownload={handleDownload}
              onDelete={handleDelete}
              onPreview={handlePreview}
              onUploadComplete={refreshDocuments}
              getFileIcon={getFileIcon}
              formatSize={formatSize}
            />
          ) : (
            <>
              {/* Zone upload classique */}
              {canUpload && (
                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
                  <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337', marginBottom: '16px' }}>
                    Ajouter des documents
                  </h2>
                  <UploadZone dossierId={dossier.id} onUploadComplete={refreshDocuments} />
                </div>
              )}

              {/* Liste documents en vrac */}
              <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', overflow: 'hidden' }}>
                <div className="px-6 py-4" style={{ borderBottom: '1px solid #EBEBEB' }}>
                  <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
                    Documents <span style={{ fontWeight: 400, color: '#585e6a', fontSize: '13px' }}>({documents.length})</span>
                  </h2>
                </div>
                {documents.length === 0 ? (
                  <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <FileText className="h-12 w-12 mx-auto mb-3" style={{ color: '#EBEBEB' }} />
                    <p style={{ fontFamily: 'Open Sans, sans-serif', color: '#585e6a', fontSize: '14px' }}>
                      Aucun document dans ce dossier
                    </p>
                  </div>
                ) : (
                  <div>
                    {documents.map((doc, idx) => (
                      <DocumentRow key={doc.id} doc={doc} idx={idx} total={documents.length}
                        onDownload={handleDownload} onDelete={handleDelete} onPreview={handlePreview}
                        canEdit={canEdit} getFileIcon={getFileIcon} formatSize={formatSize} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Preview modal */}
          {previewDoc && (
            <div
              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
              onClick={() => setPreviewDoc(null)}
            >
              <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '900px', width: '100%', maxHeight: '90vh', overflow: 'hidden', position: 'relative' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #EBEBEB' }}>
                  <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337' }} className="truncate">
                    {previewDoc.nom_fichier}
                  </p>
                  <button onClick={() => setPreviewDoc(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                    <X className="h-5 w-5" style={{ color: '#585e6a' }} />
                  </button>
                </div>
                <div style={{ height: 'calc(90vh - 56px)', overflow: 'auto' }}>
                  {previewDoc.type_mime?.startsWith('image/') ? (
                    <img src={previewUrl!} alt={previewDoc.nom_fichier} style={{ width: '100%', height: 'auto', display: 'block' }} />
                  ) : previewDoc.type_mime === 'application/pdf' ? (
                    <iframe src={previewUrl!} style={{ width: '100%', height: '100%', border: 'none' }} />
                  ) : (
                    <div style={{ padding: '48px', textAlign: 'center' }}>
                      <FileText className="h-16 w-16 mx-auto mb-4" style={{ color: '#EBEBEB' }} />
                      <p style={{ fontFamily: 'Open Sans, sans-serif', color: '#585e6a' }}>
                        Prévisualisation non disponible pour ce type de fichier
                      </p>
                      <button onClick={() => handleDownload(previewDoc)} style={{
                        marginTop: '16px', padding: '10px 20px', background: '#EE7D07', color: '#fff', border: 'none', borderRadius: '8px',
                        fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                      }}>
                        <Download className="h-4 w-4 inline mr-2" /> Télécharger
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Historique */}
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', overflow: 'hidden', alignSelf: 'start' }}>
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #EBEBEB' }}>
            <Clock className="h-4 w-4" style={{ color: '#EE7D07' }} />
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
              Historique
            </h2>
          </div>
          <div className="p-5">
            {historique.length === 0 ? (
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a', textAlign: 'center', padding: '16px 0' }}>
                Aucun changement de statut
              </p>
            ) : (
              <div className="space-y-4">
                {historique.map(h => {
                  const ancien = h.ancien_statut ? STATUT_BADGE[h.ancien_statut] : null
                  const nouveau = STATUT_BADGE[h.nouveau_statut]
                  return (
                    <div key={h.id} style={{ borderLeft: '2px solid #FFF5EB', paddingLeft: '12px' }}>
                      <div className="flex items-center gap-2 flex-wrap">
                        {ancien && (
                          <>
                            <span style={{ background: ancien.bg, color: ancien.color, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontFamily: 'Open Sans, sans-serif', fontWeight: 600 }}>
                              {ancien.label}
                            </span>
                            <span style={{ color: '#585e6a', fontSize: '12px' }}>→</span>
                          </>
                        )}
                        <span style={{ background: nouveau.bg, color: nouveau.color, padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontFamily: 'Open Sans, sans-serif', fontWeight: 600 }}>
                          {nouveau.label}
                        </span>
                      </div>
                      <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#585e6a', marginTop: '4px' }}>
                        {h.modifie_par_profile ? `${h.modifie_par_profile.prenom} ${h.modifie_par_profile.nom}` : 'Système'}
                        <br />
                        {format(new Date(h.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

/* ============================================
   Sub-components
   ============================================ */

const CATEGORY_ICONS: Record<string, any> = {
  identite: UserRound,
  logement: Home,
  comptes_bancaires: Landmark,
  credits: CreditCard,
  activite_professionnelle: Briefcase,
}

function DocumentRow({ doc, idx, total, onDownload, onDelete, onPreview, canEdit, getFileIcon, formatSize }: {
  doc: Document & { uploade_par_profile: any }
  idx: number; total: number
  onDownload: (d: Document) => void
  onDelete: (id: string) => void
  onPreview: (d: Document) => void
  canEdit: boolean
  getFileIcon: (t: string | null) => React.ReactNode
  formatSize: (b: number | null) => string
}) {
  const canPreview = doc.type_mime?.startsWith('image/') || doc.type_mime === 'application/pdf'
  return (
    <div className="flex items-center gap-3 px-6 py-3.5"
      style={{ borderBottom: idx < total - 1 ? '1px solid #EBEBEB' : 'none' }}>
      <div style={{ background: '#F5F5F5', borderRadius: '8px' }} className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
        {getFileIcon(doc.type_mime)}
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337' }} className="truncate">
          {doc.nom_fichier}
        </p>
        <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#585e6a' }}>
          {formatSize(doc.taille)}
          {doc.uploade_par_profile && <> · {doc.uploade_par_profile.prenom} {doc.uploade_par_profile.nom}</>}
          {' · '}{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: fr })}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {canPreview && (
          <button onClick={() => onPreview(doc)} title="Prévisualiser"
            style={{ padding: '6px', background: '#F0F9FF', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#0369A1' }}>
            <Eye className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => onDownload(doc)} title="Télécharger"
          style={{ padding: '6px', background: '#FFF5EB', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#EE7D07' }}>
          <Download className="h-4 w-4" />
        </button>
        {canEdit && (
          <button onClick={() => onDelete(doc.id)} title="Supprimer"
            style={{ padding: '6px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#dc2626' }}>
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function DocumentChecklist({ dossier, documents, canUpload, canEdit, onDownload, onDelete, onPreview, onUploadComplete, getFileIcon, formatSize }: {
  dossier: Dossier & { client: any; apporteur: any }
  documents: (Document & { uploade_par_profile: any })[]
  canUpload: boolean; canEdit: boolean
  onDownload: (d: Document) => void
  onDelete: (id: string) => void
  onPreview: (d: Document) => void
  onUploadComplete: () => void
  getFileIcon: (t: string | null) => React.ReactNode
  formatSize: (b: number | null) => string
}) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null)
  const [uploadingCat, setUploadingCat] = useState<string | null>(null)
  const [sendingRappel, setSendingRappel] = useState(false)
  const [rappelMessage, setRappelMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function handleRappel() {
    setSendingRappel(true)
    setRappelMessage(null)
    try {
      const res = await fetch(`/api/dossiers/${dossier.id}/rappel`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setRappelMessage({ type: 'success', text: `Rappel envoyé à ${data.email_sent_to}` })
      } else {
        setRappelMessage({ type: 'error', text: data.error || 'Erreur lors de l\'envoi' })
      }
    } catch {
      setRappelMessage({ type: 'error', text: 'Erreur réseau' })
    }
    setSendingRappel(false)
    setTimeout(() => setRappelMessage(null), 5000)
  }

  const sitLog = (dossier.situation_logement ?? 'locataire') as SituationLogement
  const sitPro = (dossier.situation_professionnelle ?? 'salarie') as SituationProfessionnelle
  const documentsRequis = getDocumentsRequis(sitLog, sitPro)

  type DocWithFiles = { id: string; label: string; categorie: string; obligatoire: boolean; uploadedFiles: (Document & { uploade_par_profile: any })[] }
  type CatWithDocs = { id: string; label: string; icon: string; docsWithFiles: DocWithFiles[]; totalRequired: number; totalFourni: number }

  // Group required docs by category
  const categoriesWithDocs: CatWithDocs[] = CATEGORIES_DOCUMENTS.map(cat => {
    const requiredDocs = documentsRequis.filter(d => d.categorie === cat.id)
    if (requiredDocs.length === 0) return null

    const docsWithFiles: DocWithFiles[] = requiredDocs.map(req => ({
      id: req.id,
      label: req.label,
      categorie: req.categorie,
      obligatoire: req.obligatoire,
      uploadedFiles: documents.filter(d => d.categorie_document === req.id),
    }))
    const totalRequired = docsWithFiles.filter(d => d.obligatoire).length
    const totalFourni = docsWithFiles.filter(d => d.obligatoire && d.uploadedFiles.length > 0).length

    return { id: cat.id, label: cat.label, icon: cat.icon, docsWithFiles, totalRequired, totalFourni }
  }).filter((c): c is CatWithDocs => c !== null)

  // Docs sans catégorie
  const uncategorizedDocs = documents.filter(d => !d.categorie_document || !documentsRequis.some(r => r.id === d.categorie_document))

  const totalRequired = categoriesWithDocs.reduce((acc: number, c: CatWithDocs) => acc + c.totalRequired, 0)
  const totalFourni = categoriesWithDocs.reduce((acc: number, c: CatWithDocs) => acc + c.totalFourni, 0)
  const progressPercent = totalRequired > 0 ? Math.round((totalFourni / totalRequired) * 100) : 0

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div style={{ background: '#fff', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
            Pièces justificatives
          </h2>
          <div className="flex items-center gap-3">
            <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '15px', color: progressPercent === 100 ? '#16a34a' : '#EE7D07' }}>
              {totalFourni}/{totalRequired} obligatoires
            </span>
            {canEdit && totalFourni < totalRequired && (
              <button
                onClick={handleRappel}
                disabled={sendingRappel}
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#FFF5EB',
                  color: '#EE7D07',
                  cursor: sendingRappel ? 'not-allowed' : 'pointer',
                  opacity: sendingRappel ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {sendingRappel ? 'Envoi...' : '\u{1F4E7} Rappel'}
              </button>
            )}
            {canEdit && documents.length > 0 && (
              <a
                href={`/api/dossiers/${dossier.id}/export-banque`}
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '5px 12px',
                  borderRadius: '8px',
                  background: '#EFF6FF',
                  color: '#2563eb',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                title="Télécharger 5 PDFs groupés (identité, banque, logement, revenu, prêts) pour envoi banque"
              >
                <Download className="h-3.5 w-3.5" />
                Export banque
              </a>
            )}
          </div>
        </div>
        {rappelMessage && (
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            fontFamily: 'Open Sans, sans-serif',
            background: rappelMessage.type === 'success' ? '#DCFCE7' : '#FEF2F2',
            color: rappelMessage.type === 'success' ? '#16a34a' : '#dc2626',
          }}>
            {rappelMessage.text}
          </div>
        )}
        <div style={{ background: '#F5F5F5', borderRadius: '8px', height: '8px', overflow: 'hidden' }}>
          <div style={{
            background: progressPercent === 100 ? '#16a34a' : '#EE7D07',
            width: `${progressPercent}%`, height: '100%', borderRadius: '8px',
            transition: 'width 0.5s ease',
          }} />
        </div>
        {dossier.emprunt_a_deux && (
          <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#dc2626', fontWeight: 600, marginTop: '8px' }}>
            Emprunt à deux : tous les documents sont à fournir par les deux emprunteurs
          </p>
        )}
      </div>

      {/* Categories */}
      {categoriesWithDocs.map(cat => {
        const Icon = CATEGORY_ICONS[cat.id] ?? FileText
        const isExpanded = expandedCat === cat.id
        const isComplete = cat.totalFourni === cat.totalRequired

        return (
          <div key={cat.id} style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', overflow: 'hidden' }}>
            {/* Category header */}
            <button
              onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
              className="w-full flex items-center justify-between px-5 py-4"
              style={{ border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <div className="flex items-center gap-3">
                <div style={{ background: isComplete ? '#DCFCE7' : '#FFF5EB', borderRadius: '8px' }}
                  className="w-9 h-9 flex-shrink-0 flex items-center justify-center">
                  <Icon className="h-5 w-5" style={{ color: isComplete ? '#16a34a' : '#EE7D07' }} />
                </div>
                <div>
                  <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337' }}>
                    {cat.label}
                  </p>
                  <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: isComplete ? '#16a34a' : '#585e6a' }}>
                    {cat.totalFourni}/{cat.totalRequired} document{cat.totalRequired > 1 ? 's' : ''} obligatoire{cat.totalRequired > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 flex-shrink-0 transition-transform" style={{
                color: '#585e6a', transform: isExpanded ? 'rotate(90deg)' : 'none',
              }} />
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div style={{ borderTop: '1px solid #EBEBEB' }}>
                {cat.docsWithFiles.map((req, idx) => (
                  <div key={req.id} style={{ borderBottom: idx < cat.docsWithFiles.length - 1 ? '1px solid #F5F5F5' : 'none' }}>
                    {/* Required doc header */}
                    <div className="flex items-start gap-3 px-5 py-3">
                      {req.uploadedFiles.length > 0 ? (
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
                      ) : (
                        <Circle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: req.obligatoire ? '#EBEBEB' : '#E5E7EB' }} />
                      )}
                      <div className="flex-1 min-w-0">
                        <p style={{
                          fontFamily: 'Open Sans, sans-serif', fontSize: '13px',
                          color: req.uploadedFiles.length > 0 ? '#112337' : '#585e6a',
                          fontWeight: req.uploadedFiles.length > 0 ? 600 : 400,
                        }}>
                          {req.label}
                          {!req.obligatoire && (
                            <span style={{ fontStyle: 'italic', color: '#9CA3AF', fontSize: '11px', marginLeft: '6px' }}>optionnel</span>
                          )}
                        </p>

                        {/* Uploaded files for this requirement */}
                        {req.uploadedFiles.map(doc => (
                          <div key={doc.id} className="flex items-center gap-2 mt-2 ml-1" style={{ background: '#F9FAFB', borderRadius: '6px', padding: '6px 10px' }}>
                            <div className="flex-shrink-0">{getFileIcon(doc.type_mime)}</div>
                            <div className="flex-1 min-w-0">
                              <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '12px', color: '#112337' }} className="truncate">
                                {doc.nom_fichier}
                              </p>
                              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '10px', color: '#585e6a' }}>
                                {formatSize(doc.taille)} · {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true, locale: fr })}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              {(doc.type_mime?.startsWith('image/') || doc.type_mime === 'application/pdf') && (
                                <button onClick={() => onPreview(doc)} title="Prévisualiser"
                                  style={{ padding: '4px', background: '#F0F9FF', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#0369A1' }}>
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button onClick={() => onDownload(doc)} title="Télécharger"
                                style={{ padding: '4px', background: '#FFF5EB', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#EE7D07' }}>
                                <Download className="h-3.5 w-3.5" />
                              </button>
                              {canEdit && (
                                <button onClick={() => onDelete(doc.id)} title="Supprimer"
                                  style={{ padding: '4px', background: '#FEF2F2', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#dc2626' }}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}

                        {/* Upload zone for this requirement */}
                        {canUpload && uploadingCat === req.id && (
                          <div className="mt-2">
                            <UploadZone dossierId={dossier.id} categorieDocument={req.id} onUploadComplete={() => { setUploadingCat(null); onUploadComplete() }} compact />
                          </div>
                        )}
                        {canUpload && uploadingCat !== req.id && (
                          <button
                            onClick={() => setUploadingCat(req.id)}
                            className="flex items-center gap-1 mt-2"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#EE7D07', fontWeight: 600, padding: '2px 0' }}
                          >
                            <Upload className="h-3 w-3" /> Ajouter un fichier
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Uncategorized documents */}
      {uncategorizedDocs.length > 0 && (
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', overflow: 'hidden' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #EBEBEB' }}>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
              Autres documents <span style={{ fontWeight: 400, color: '#585e6a', fontSize: '13px' }}>({uncategorizedDocs.length})</span>
            </h2>
          </div>
          {uncategorizedDocs.map((doc, idx) => (
            <DocumentRow key={doc.id} doc={doc} idx={idx} total={uncategorizedDocs.length}
              onDownload={onDownload} onDelete={onDelete} onPreview={onPreview}
              canEdit={canEdit} getFileIcon={getFileIcon} formatSize={formatSize} />
          ))}
        </div>
      )}

      {/* Zone upload générale */}
      {canUpload && (
        <div style={{ background: '#fff', borderRadius: '12px', padding: '20px 24px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)' }}>
          <h3 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337', marginBottom: '12px' }}>
            Ajouter un document sans catégorie
          </h3>
          <UploadZone dossierId={dossier.id} onUploadComplete={onUploadComplete} compact />
        </div>
      )}
    </div>
  )
}
