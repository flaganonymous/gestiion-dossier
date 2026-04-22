'use client'

import { useState, useCallback, useRef } from 'react'
import { Loader2, Upload, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadFile {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

interface UploadZoneProps {
  dossierId: string
  categorieDocument?: string
  onUploadComplete: () => void
  compact?: boolean
}

export function UploadZone({ dossierId, categorieDocument, onUploadComplete, compact }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    // HEIC (iPhone) : le navigateur ne renseigne pas toujours le type,
    // on gere aussi la detection par extension dans isHeic() plus bas.
    'image/heic', 'image/heif',
  ]
  const MAX_SIZE = 20 * 1024 * 1024

  function isHeic(file: File) {
    const type = (file.type || '').toLowerCase()
    if (type === 'image/heic' || type === 'image/heif') return true
    const name = file.name.toLowerCase()
    return name.endsWith('.heic') || name.endsWith('.heif')
  }

  async function convertHeicToJpeg(file: File): Promise<File> {
    // heic2any n'existe que cote navigateur : import dynamique.
    const heic2any = (await import('heic2any')).default
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
    const jpegBlob = Array.isArray(blob) ? blob[0] : blob
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
    return new File([jpegBlob], newName, { type: 'image/jpeg' })
  }

  async function uploadFile(uf: UploadFile, index: number) {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'uploading' } : f))
    try {
      // Conversion HEIC -> JPEG cote navigateur avant upload.
      // Sinon Chrome/Firefox ne peuvent pas afficher le fichier et
      // pdf-lib ne peut pas l'integrer dans l'export banque.
      let fileToUpload = uf.file
      if (isHeic(uf.file)) {
        fileToUpload = await convertHeicToJpeg(uf.file)
        setFiles(prev => prev.map((f, i) => i === index ? { ...f, file: fileToUpload } : f))
      }

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dossierId, nomFichier: fileToUpload.name, contentType: fileToUpload.type, taille: fileToUpload.size, categorieDocument }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur serveur')
      const { uploadUrl } = data
      const s3Res = await fetch(uploadUrl, { method: 'PUT', body: fileToUpload, headers: { 'Content-Type': fileToUpload.type } })
      if (!s3Res.ok) throw new Error("Erreur lors de l'upload vers S3")
      setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'done' } : f))
      onUploadComplete()
    } catch (err: any) {
      setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'error', error: err.message } : f))
    }
  }

  function addFiles(newFiles: File[]) {
    const validated = newFiles.map(file => {
      // HEIC : le type MIME peut etre vide selon le navigateur, on
      // accepte aussi par extension.
      const ok = ALLOWED_TYPES.includes(file.type) || isHeic(file)
      if (!ok) return { file, status: 'error' as const, error: 'Type non autorisé (PDF, Word, images)' }
      if (file.size > MAX_SIZE) return { file, status: 'error' as const, error: 'Fichier trop lourd (max 20 Mo)' }
      return { file, status: 'pending' as const }
    })
    setFiles(prev => {
      const updated = [...prev, ...validated]
      validated.forEach((uf, i) => {
        if (uf.status === 'pending') {
          const idx = prev.length + i
          setTimeout(() => uploadFile({ ...uf }, idx), 0)
        }
      })
      return updated
    })
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [dossierId])

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? '#EE7D07' : '#EBEBEB'}`,
          borderRadius: compact ? '8px' : '10px',
          padding: compact ? '12px 16px' : '32px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? '#FFF5EB' : '#FAFAFA',
          transition: 'all 0.2s',
        }}
      >
        {compact ? (
          <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Upload className="h-3.5 w-3.5" style={{ color: '#EE7D07' }} />
            <span style={{ color: '#EE7D07', fontWeight: 600 }}>Cliquez pour ajouter</span> ou glissez-déposez
          </p>
        ) : (
          <>
            <div style={{ background: '#FFF5EB', borderRadius: '10px', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <Upload className="h-5 w-5" style={{ color: '#EE7D07' }} />
            </div>
            <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '14px', color: '#112337', marginBottom: '4px' }}>
              Glissez-déposez vos fichiers ici
            </p>
            <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
              ou <span style={{ color: '#EE7D07', fontWeight: 600 }}>cliquez pour sélectionner</span> — PDF, Word, images (max 20 Mo)
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif"
          className="hidden"
          onChange={e => e.target.files && addFiles(Array.from(e.target.files))}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uf, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: '#fff', borderRadius: '8px', border: '1px solid #EBEBEB' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337' }} className="truncate">
                  {uf.file.name}
                </p>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '11px', color: '#585e6a' }}>
                  {formatSize(uf.file.size)}
                </p>
              </div>
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
    </div>
  )
}
