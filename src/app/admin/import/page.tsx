'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Navbar } from '@/components/navbar'
import { Profile } from '@/lib/supabase/types'
import { SITUATION_LOGEMENT_LABELS, SITUATION_PROFESSIONNELLE_LABELS } from '@/lib/documents-checklist'
import { Loader2, Upload, CheckCircle, XCircle, FolderUp, ArrowLeft, FolderPlus, FolderOpen } from 'lucide-react'
import Link from 'next/link'

type ImportMode = 'new' | 'existing' | null
type FileStatus = 'pending' | 'uploading' | 'done' | 'error'

interface ImportFile {
  file: File
  status: FileStatus
  error?: string
}

interface DossierOption {
  id: string
  titre: string
  annee: number
  statut: string
  client: { nom: string; prenom: string } | null
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]
const MAX_SIZE = 20 * 1024 * 1024

export default function ImportPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [clients, setClients] = useState<Profile[]>([])
  const [apporteurs, setApporteurs] = useState<Profile[]>([])
  const [pageLoading, setPageLoading] = useState(true)

  const [mode, setMode] = useState<ImportMode>(null)

  // New dossier form
  const [titre, setTitre] = useState('')
  const [clientId, setClientId] = useState('')
  const [apporteurId, setApporteurId] = useState('')
  const [situationLogement, setSituationLogement] = useState('locataire')
  const [situationProfessionnelle, setSituationProfessionnelle] = useState('salarie')
  const [empruntADeux, setEmpruntADeux] = useState(false)

  // Existing dossier
  const [dossiers, setDossiers] = useState<DossierOption[]>([])
  const [dossiersLoading, setDossiersLoading] = useState(false)
  const [selectedDossierId, setSelectedDossierId] = useState('')

  // Files
  const [files, setFiles] = useState<ImportFile[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Import state
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [importComplete, setImportComplete] = useState(false)
  const [importedDossierId, setImportedDossierId] = useState<string | null>(null)
  const [importError, setImportError] = useState('')
  const [successCount, setSuccessCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : Promise.reject('Not authenticated'))
      .then(data => {
        if (data.profile.role !== 'admin') {
          window.location.href = '/dashboard'
          return
        }
        setProfile(data.profile)
        setClients(data.clients ?? [])
        setApporteurs(data.apporteurs ?? [])
      })
      .catch(() => { window.location.href = '/login' })
      .finally(() => setPageLoading(false))
  }, [])

  useEffect(() => {
    if (mode === 'existing') {
      setDossiersLoading(true)
      fetch('/api/admin/import')
        .then(res => res.ok ? res.json() : Promise.reject('Erreur'))
        .then(data => setDossiers(data))
        .catch(() => setDossiers([]))
        .finally(() => setDossiersLoading(false))
    }
  }, [mode])

  function addFiles(newFiles: File[]) {
    const validated: ImportFile[] = newFiles.map(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { file, status: 'error' as const, error: 'Type non autorise (PDF, Word, images)' }
      }
      if (file.size > MAX_SIZE) {
        return { file, status: 'error' as const, error: 'Fichier trop lourd (max 20 Mo)' }
      }
      return { file, status: 'pending' as const }
    })
    setFiles(prev => [...prev, ...validated])
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [])

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
  }

  const pendingFiles = files.filter(f => f.status === 'pending')

  async function handleImport() {
    if (mode === 'new' && !titre.trim()) {
      setImportError('Le titre du dossier est requis.')
      return
    }
    if (mode === 'existing' && !selectedDossierId) {
      setImportError('Veuillez selectionner un dossier.')
      return
    }
    if (pendingFiles.length === 0) {
      setImportError('Veuillez ajouter au moins un fichier.')
      return
    }

    setImportError('')
    setImporting(true)
    setProgress({ current: 0, total: pendingFiles.length })

    try {
      const body: Record<string, unknown> = {
        mode,
        files: pendingFiles.map(f => ({
          nomFichier: f.file.name,
          contentType: f.file.type,
          taille: f.file.size,
        })),
      }

      if (mode === 'new') {
        body.dossier = {
          titre: titre.trim(),
          client_id: clientId || undefined,
          apporteur_id: apporteurId || undefined,
          situation_logement: situationLogement,
          situation_professionnelle: situationProfessionnelle,
          emprunt_a_deux: empruntADeux,
        }
      } else {
        body.dossierId = selectedDossierId
      }

      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')

      setImportedDossierId(data.dossierId)

      // Upload each file to S3 using presigned URLs
      let ok = 0
      let fail = 0

      for (let i = 0; i < pendingFiles.length; i++) {
        const pf = pendingFiles[i]
        const result = data.results[i]

        // Update file status to uploading
        setFiles(prev => prev.map(f => f === pf ? { ...f, status: 'uploading' as const } : f))
        setProgress({ current: i, total: pendingFiles.length })

        if (result.error) {
          setFiles(prev => prev.map(f => f === pf ? { ...f, status: 'error' as const, error: result.error } : f))
          fail++
          continue
        }

        try {
          const s3Res = await fetch(result.uploadUrl, {
            method: 'PUT',
            body: pf.file,
            headers: { 'Content-Type': pf.file.type },
          })
          if (!s3Res.ok) throw new Error('Erreur S3')
          setFiles(prev => prev.map(f => f === pf ? { ...f, status: 'done' as const } : f))
          ok++
        } catch {
          setFiles(prev => prev.map(f => f === pf ? { ...f, status: 'error' as const, error: "Erreur lors de l'upload" } : f))
          fail++
        }

        setProgress({ current: i + 1, total: pendingFiles.length })
      }

      setSuccessCount(ok)
      setErrorCount(fail)
      setImportComplete(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      setImportError(message)
    } finally {
      setImporting(false)
    }
  }

  function resetForm() {
    setMode(null)
    setTitre('')
    setClientId('')
    setApporteurId('')
    setSituationLogement('locataire')
    setSituationProfessionnelle('salarie')
    setEmpruntADeux(false)
    setSelectedDossierId('')
    setFiles([])
    setImportComplete(false)
    setImportedDossierId(null)
    setImportError('')
    setSuccessCount(0)
    setErrorCount(0)
    setProgress({ current: 0, total: 0 })
  }

  if (pageLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#EE7D07' }} />
      </div>
    )
  }

  if (!profile) return null

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid #EBEBEB', borderRadius: '8px',
    fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#112337',
    outline: 'none', transition: 'border-color 0.2s',
    background: '#fff',
  } as const

  const labelStyle = {
    fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px',
    color: '#112337', display: 'block' as const, marginBottom: '6px',
  } as const

  const selectedDossier = dossiers.find(d => d.id === selectedDossierId)

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <Navbar profile={profile} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard" className="flex items-center gap-1 mb-4" style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a', textDecoration: 'none' }}>
            <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
          </Link>
          <div className="flex items-center gap-3">
            <div style={{ background: '#FFF5EB', borderRadius: '10px' }} className="w-10 h-10 flex items-center justify-center">
              <FolderUp className="h-5 w-5" style={{ color: '#EE7D07' }} />
            </div>
            <div>
              <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px', color: '#112337' }}>
                Import en masse
              </h1>
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                Importez des documents en masse dans vos dossiers
              </p>
            </div>
          </div>
        </div>

        {/* Import complete */}
        {importComplete && (
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', padding: '32px', textAlign: 'center' }}>
            <div style={{ background: '#F0FDF4', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle className="h-7 w-7" style={{ color: '#16a34a' }} />
            </div>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337', marginBottom: '8px' }}>
              Import termine
            </h2>
            <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#585e6a', marginBottom: '24px' }}>
              {successCount} fichier{successCount > 1 ? 's' : ''} importe{successCount > 1 ? 's' : ''} avec succes
              {errorCount > 0 && (<>, <span style={{ color: '#dc2626' }}>{errorCount} erreur{errorCount > 1 ? 's' : ''}</span></>)}
            </p>

            {/* File results list */}
            <div style={{ marginBottom: '24px', textAlign: 'left' }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 14px', background: '#F5F5F5', borderRadius: '8px', marginBottom: '4px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.file.name}
                    </p>
                  </div>
                  {f.status === 'done' && <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#16a34a' }} />}
                  {f.status === 'error' && (
                    <div className="flex items-center gap-1" style={{ color: '#dc2626' }}>
                      <XCircle className="h-4 w-4 flex-shrink-0" />
                      <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px' }}>{f.error}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-3">
              {importedDossierId && (
                <Link href={`/dossiers/${importedDossierId}`}>
                  <button
                    type="button"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#EE7D07', color: '#fff', border: 'none',
                      padding: '10px 24px', borderRadius: '8px',
                      fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                      cursor: 'pointer',
                    }}
                  >
                    Voir le dossier
                  </button>
                </Link>
              )}
              <button
                type="button"
                onClick={resetForm}
                style={{
                  background: '#fff', color: '#585e6a', border: '1.5px solid #EBEBEB',
                  padding: '10px 24px', borderRadius: '8px',
                  fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Nouvel import
              </button>
            </div>
          </div>
        )}

        {/* Mode selection */}
        {!importComplete && !mode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => setMode('new')}
              style={{
                background: '#fff', border: '1.5px solid #EBEBEB', borderRadius: '12px',
                padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#EE7D07'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(32,76,229,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEB'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ background: '#FFF5EB', borderRadius: '12px', width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FolderPlus className="h-6 w-6" style={{ color: '#EE7D07' }} />
              </div>
              <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '16px', color: '#112337', marginBottom: '4px' }}>
                Nouveau dossier
              </p>
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                Creer un dossier et importer des fichiers
              </p>
            </button>

            <button
              onClick={() => setMode('existing')}
              style={{
                background: '#fff', border: '1.5px solid #EBEBEB', borderRadius: '12px',
                padding: '32px 24px', textAlign: 'center', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#EE7D07'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(32,76,229,0.1)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#EBEBEB'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ background: '#FFF5EB', borderRadius: '12px', width: '52px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <FolderOpen className="h-6 w-6" style={{ color: '#EE7D07' }} />
              </div>
              <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '16px', color: '#112337', marginBottom: '4px' }}>
                Dossier existant
              </p>
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                Ajouter des fichiers a un dossier existant
              </p>
            </button>
          </div>
        )}

        {/* Mode: New Dossier */}
        {!importComplete && mode === 'new' && (
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', padding: '32px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px', color: '#112337' }}>
                Nouveau dossier + import de fichiers
              </h2>
              <button
                onClick={() => { setMode(null); setFiles([]) }}
                style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Changer de mode
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label style={labelStyle}>Titre du dossier *</label>
                <input
                  value={titre}
                  onChange={e => setTitre(e.target.value)}
                  placeholder="Ex : Dupont Jean — Rachat credit immobilier"
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = '#EE7D07'}
                  onBlur={e => e.currentTarget.style.borderColor = '#EBEBEB'}
                />
              </div>

              {clients.length > 0 && (
                <div>
                  <label style={labelStyle}>Client</label>
                  <select value={clientId} onChange={e => setClientId(e.target.value)} style={inputStyle}>
                    <option value="">Selectionner un client...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.prenom} {c.nom} — {c.email}</option>
                    ))}
                  </select>
                </div>
              )}

              {apporteurs.length > 0 && (
                <div>
                  <label style={labelStyle}>Apporteur d&apos;affaire</label>
                  <select value={apporteurId} onChange={e => setApporteurId(e.target.value)} style={inputStyle}>
                    <option value="">Selectionner un apporteur...</option>
                    {apporteurs.map(a => (
                      <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={labelStyle}>Situation logement</label>
                <select value={situationLogement} onChange={e => setSituationLogement(e.target.value)} style={inputStyle}>
                  {Object.entries(SITUATION_LOGEMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Situation professionnelle</label>
                <select value={situationProfessionnelle} onChange={e => setSituationProfessionnelle(e.target.value)} style={inputStyle}>
                  {Object.entries(SITUATION_PROFESSIONNELLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="empruntADeux"
                  checked={empruntADeux}
                  onChange={e => setEmpruntADeux(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#EE7D07' }}
                />
                <label htmlFor="empruntADeux" style={{ ...labelStyle, marginBottom: 0 }}>
                  Emprunt a deux
                </label>
              </div>

              {/* Separator */}
              <div style={{ borderTop: '1px solid #EBEBEB', paddingTop: '20px' }}>
                <label style={{ ...labelStyle, fontSize: '15px', marginBottom: '12px' }}>Fichiers a importer</label>
                {renderDropZone()}
              </div>

              {renderFileList()}

              {importError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626' }}>
                  {importError}
                </div>
              )}

              {importing && renderProgress()}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={importing}
                  onClick={handleImport}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: importing ? '#F5B86C' : '#EE7D07', color: '#fff', border: 'none',
                    padding: '10px 24px', borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                    cursor: importing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Importer {pendingFiles.length > 0 ? `(${pendingFiles.length} fichier${pendingFiles.length > 1 ? 's' : ''})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode(null); setFiles([]) }}
                  disabled={importing}
                  style={{
                    background: '#fff', color: '#585e6a', border: '1.5px solid #EBEBEB',
                    padding: '10px 24px', borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                    cursor: importing ? 'not-allowed' : 'pointer',
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mode: Existing Dossier */}
        {!importComplete && mode === 'existing' && (
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', padding: '32px' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px', color: '#112337' }}>
                Import dans un dossier existant
              </h2>
              <button
                onClick={() => { setMode(null); setFiles([]) }}
                style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Changer de mode
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label style={labelStyle}>Dossier cible *</label>
                {dossiersLoading ? (
                  <div className="flex items-center gap-2" style={{ padding: '10px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#EE7D07' }} />
                    Chargement des dossiers...
                  </div>
                ) : (
                  <select value={selectedDossierId} onChange={e => setSelectedDossierId(e.target.value)} style={inputStyle}>
                    <option value="">Selectionner un dossier...</option>
                    {dossiers.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.titre} ({d.annee}) — {d.statut === 'en_cours' ? 'En cours' : d.statut === 'finance' ? 'Finance' : 'Refuse'}
                        {d.client ? ` — ${d.client.prenom} ${d.client.nom}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedDossier && (
                <div style={{ background: '#F5F5F5', borderRadius: '8px', padding: '14px 16px' }}>
                  <p style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337', marginBottom: '4px' }}>
                    {selectedDossier.titre}
                  </p>
                  <div className="flex items-center gap-3">
                    <span style={{
                      fontFamily: 'Open Sans, sans-serif', fontSize: '12px', fontWeight: 600,
                      padding: '2px 10px', borderRadius: '9999px',
                      background: selectedDossier.statut === 'en_cours' ? '#DBEAFE' : selectedDossier.statut === 'finance' ? '#DCFCE7' : '#FEE2E2',
                      color: selectedDossier.statut === 'en_cours' ? '#1e40af' : selectedDossier.statut === 'finance' ? '#166534' : '#991b1b',
                    }}>
                      {selectedDossier.statut === 'en_cours' ? 'En cours' : selectedDossier.statut === 'finance' ? 'Finance' : 'Refuse'}
                    </span>
                    {selectedDossier.client && (
                      <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
                        Client : {selectedDossier.client.prenom} {selectedDossier.client.nom}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Separator */}
              <div style={{ borderTop: '1px solid #EBEBEB', paddingTop: '20px' }}>
                <label style={{ ...labelStyle, fontSize: '15px', marginBottom: '12px' }}>Fichiers a importer</label>
                {renderDropZone()}
              </div>

              {renderFileList()}

              {importError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626' }}>
                  {importError}
                </div>
              )}

              {importing && renderProgress()}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={importing}
                  onClick={handleImport}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    background: importing ? '#F5B86C' : '#EE7D07', color: '#fff', border: 'none',
                    padding: '10px 24px', borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                    cursor: importing ? 'not-allowed' : 'pointer',
                  }}
                >
                  {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Importer {pendingFiles.length > 0 ? `(${pendingFiles.length} fichier${pendingFiles.length > 1 ? 's' : ''})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode(null); setFiles([]) }}
                  disabled={importing}
                  style={{
                    background: '#fff', color: '#585e6a', border: '1.5px solid #EBEBEB',
                    padding: '10px 24px', borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                    cursor: importing ? 'not-allowed' : 'pointer',
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )

  function renderDropZone() {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#EE7D07' : '#EBEBEB'}`,
          borderRadius: '10px',
          padding: '40px 24px',
          textAlign: 'center',
          cursor: importing ? 'not-allowed' : 'pointer',
          background: dragging ? '#FFF5EB' : '#FAFAFA',
          transition: 'all 0.2s',
          opacity: importing ? 0.6 : 1,
        }}
      >
        <div style={{ background: '#FFF5EB', borderRadius: '10px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Upload className="h-6 w-6" style={{ color: '#EE7D07' }} />
        </div>
        <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337', marginBottom: '4px' }}>
          Glissez-deposez vos fichiers ici
        </p>
        <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
          ou <span style={{ color: '#EE7D07', fontWeight: 600 }}>cliquez pour selectionner</span> — PDF, Word, images (max 20 Mo par fichier)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
          disabled={importing}
          onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)); e.target.value = '' }}
        />
      </div>
    )
  }

  function renderFileList() {
    if (files.length === 0) return null
    return (
      <div className="space-y-2">
        {files.map((uf, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid #EBEBEB' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {uf.file.name}
              </p>
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#585e6a' }}>
                {formatSize(uf.file.size)}
              </p>
            </div>
            {uf.status === 'pending' && !importing && (
              <button
                onClick={() => removeFile(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                title="Retirer"
              >
                <XCircle className="h-4 w-4" style={{ color: '#585e6a' }} />
              </button>
            )}
            {uf.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" style={{ color: '#EE7D07' }} />}
            {uf.status === 'done' && <CheckCircle className="h-4 w-4 flex-shrink-0" style={{ color: '#16a34a' }} />}
            {uf.status === 'error' && (
              <div className="flex items-center gap-1" style={{ color: '#dc2626' }}>
                <XCircle className="h-4 w-4 flex-shrink-0" />
                <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px' }}>{uf.error}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  function renderProgress() {
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
    return (
      <div style={{ padding: '16px', background: '#F5F5F5', borderRadius: '8px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
          <span style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337' }}>
            Upload en cours...
          </span>
          <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
            {progress.current} / {progress.total}
          </span>
        </div>
        <div style={{ width: '100%', height: '8px', background: '#EBEBEB', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#EE7D07', borderRadius: '4px', transition: 'width 0.3s ease' }} />
        </div>
      </div>
    )
  }
}
