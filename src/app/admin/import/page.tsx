'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Navbar } from '@/components/navbar'
import { Apporteur, Profile } from '@/lib/supabase/types'
import { Loader2, Upload, CheckCircle, XCircle, FolderUp, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type FileStatus = 'pending' | 'uploading' | 'done' | 'error'

interface ImportFile {
  file: File
  status: FileStatus
  error?: string
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
]
const MAX_SIZE = 20 * 1024 * 1024

const currentYear = new Date().getFullYear()
const ANNEES = Array.from({ length: 10 }, (_, i) => currentYear - i)

export default function ImportPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [apporteurs, setApporteurs] = useState<Apporteur[]>([])
  const [pageLoading, setPageLoading] = useState(true)

  // Form — minimal
  const [titre, setTitre] = useState('')
  const [annee, setAnnee] = useState(currentYear)
  const [statut, setStatut] = useState<'finance' | 'refuse' | 'en_cours'>('finance')
  const [apporteurId, setApporteurId] = useState('')

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
        setApporteurs(data.apporteurs ?? [])
      })
      .catch(() => { window.location.href = '/login' })
      .finally(() => setPageLoading(false))
  }, [])

  function addFiles(newFiles: File[]) {
    const validated: ImportFile[] = newFiles.map(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { file, status: 'error' as const, error: 'Type non autorisé (PDF, Word, images)' }
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
    if (!titre.trim()) { setImportError('Le nom du dossier est requis.'); return }
    if (pendingFiles.length === 0) { setImportError('Ajoutez au moins un fichier.'); return }

    setImportError('')
    setImporting(true)
    setProgress({ current: 0, total: pendingFiles.length })

    try {
      const res = await fetch('/api/admin/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossier: {
            titre: titre.trim(),
            annee,
            statut,
            apporteur_id: apporteurId || null,
          },
          files: pendingFiles.map(f => ({
            nomFichier: f.file.name,
            contentType: f.file.type,
            taille: f.file.size,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')

      setImportedDossierId(data.dossierId)

      let ok = 0, fail = 0
      for (let i = 0; i < pendingFiles.length; i++) {
        const pf = pendingFiles[i]
        const result = data.results[i]

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
    setTitre('')
    setAnnee(currentYear)
    setStatut('finance')
    setApporteurId('')
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

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid #EBEBEB', borderRadius: '8px',
    fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#112337',
    outline: 'none', transition: 'border-color 0.2s',
    background: '#fff',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px',
    color: '#112337', display: 'block', marginBottom: '6px',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F5F5' }}>
      <Navbar profile={profile} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
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
                Import d&apos;un ancien dossier
              </h1>
              <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                Un dossier par import. Nom, année, statut, apporteur, puis fichiers en masse.
              </p>
            </div>
          </div>
        </div>

        {importComplete ? (
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', padding: '32px', textAlign: 'center' }}>
            <div style={{ background: '#F0FDF4', borderRadius: '50%', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle className="h-7 w-7" style={{ color: '#16a34a' }} />
            </div>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337', marginBottom: '8px' }}>
              Import terminé
            </h2>
            <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#585e6a', marginBottom: '24px' }}>
              {successCount} fichier{successCount > 1 ? 's' : ''} importé{successCount > 1 ? 's' : ''}
              {errorCount > 0 && (<>, <span style={{ color: '#dc2626' }}>{errorCount} erreur{errorCount > 1 ? 's' : ''}</span></>)}
            </p>

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
                  <button type="button" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#EE7D07', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
                    Voir le dossier
                  </button>
                </Link>
              )}
              <button type="button" onClick={resetForm}
                style={{ background: '#fff', color: '#585e6a', border: '1.5px solid #EBEBEB', padding: '10px 24px', borderRadius: '8px', fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Importer un autre dossier
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(17,35,55,0.06)', padding: '32px' }}>
            <div className="space-y-5">
              <div>
                <label style={labelStyle}>Nom du dossier *</label>
                <input
                  value={titre}
                  onChange={e => setTitre(e.target.value)}
                  placeholder="Ex : Dupont Jean"
                  style={inputStyle}
                  onFocus={e => e.currentTarget.style.borderColor = '#EE7D07'}
                  onBlur={e => e.currentTarget.style.borderColor = '#EBEBEB'}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Année *</label>
                  <select value={annee} onChange={e => setAnnee(parseInt(e.target.value))} style={inputStyle}>
                    {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Statut *</label>
                  <select
                    value={statut}
                    onChange={e => setStatut(e.target.value as 'finance' | 'refuse' | 'en_cours')}
                    style={inputStyle}
                  >
                    <option value="finance">Financé</option>
                    <option value="refuse">Non financé</option>
                    <option value="en_cours">En cours</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Apporteur d&apos;affaires (optionnel)</label>
                <select value={apporteurId} onChange={e => setApporteurId(e.target.value)} style={inputStyle}>
                  <option value="">Aucun apporteur</option>
                  {apporteurs.map(a => (
                    <option key={a.id} value={a.id}>{a.prenom} {a.nom}</option>
                  ))}
                </select>
                {apporteurs.length === 0 && (
                  <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a', marginTop: '4px' }}>
                    Aucun apporteur référencé. <Link href="/admin/apporteurs" style={{ color: '#EE7D07', fontWeight: 600 }}>Gérer les apporteurs</Link>
                  </p>
                )}
              </div>

              <div style={{ borderTop: '1px solid #EBEBEB', paddingTop: '20px' }}>
                <label style={{ ...labelStyle, fontSize: '15px', marginBottom: '12px' }}>Documents à importer</label>
                <div
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onClick={() => inputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? '#EE7D07' : '#EBEBEB'}`,
                    borderRadius: '10px', padding: '40px 24px', textAlign: 'center',
                    cursor: importing ? 'not-allowed' : 'pointer',
                    background: dragging ? '#FFF5EB' : '#FAFAFA',
                    transition: 'all 0.2s', opacity: importing ? 0.6 : 1,
                  }}
                >
                  <div style={{ background: '#FFF5EB', borderRadius: '10px', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Upload className="h-6 w-6" style={{ color: '#EE7D07' }} />
                  </div>
                  <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337', marginBottom: '4px' }}>
                    Glissez-déposez les fichiers ici
                  </p>
                  <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
                    ou <span style={{ color: '#EE7D07', fontWeight: 600 }}>cliquez pour sélectionner</span> — PDF, Word, images (max 20 Mo par fichier)
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
              </div>

              {files.length > 0 && (
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
                        <button onClick={() => removeFile(i)}
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
              )}

              {importError && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626' }}>
                  {importError}
                </div>
              )}

              {importing && (
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
                    <div style={{ width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%`, height: '100%', background: '#EE7D07', borderRadius: '4px', transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              )}

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
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
