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
  onUploadComplete: () => void
}

export function UploadZone({ dossierId, onUploadComplete }: UploadZoneProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const ALLOWED_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ]
  const MAX_SIZE = 20 * 1024 * 1024 // 20 MB

  async function uploadFile(uf: UploadFile, index: number) {
    setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'uploading' } : f))

    try {
      // 1. Demander l'URL pré-signée au serveur
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossierId,
          nomFichier: uf.file.name,
          contentType: uf.file.type,
          taille: uf.file.size,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error)

      const { uploadUrl } = await res.json()

      // 2. Upload direct vers S3
      const s3Res = await fetch(uploadUrl, {
        method: 'PUT',
        body: uf.file,
        headers: { 'Content-Type': uf.file.type },
      })

      if (!s3Res.ok) throw new Error('Erreur lors de l\'upload vers S3')

      setFiles(prev => prev.map((f, i) => i === index ? { ...f, status: 'done' } : f))
      onUploadComplete()
    } catch (err: any) {
      setFiles(prev =>
        prev.map((f, i) => i === index ? { ...f, status: 'error', error: err.message } : f)
      )
    }
  }

  function addFiles(newFiles: File[]) {
    const validated = newFiles.map(file => {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return { file, status: 'error' as const, error: 'Type non autorisé (PDF, Word, images)' }
      }
      if (file.size > MAX_SIZE) {
        return { file, status: 'error' as const, error: 'Fichier trop lourd (max 20 Mo)' }
      }
      return { file, status: 'pending' as const }
    })

    setFiles(prev => {
      const updated = [...prev, ...validated]
      // Lancer l'upload pour les fichiers valides
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} o`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
  }

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          dragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
        )}
      >
        <Upload className="h-8 w-8 mx-auto mb-3 text-gray-400" />
        <p className="text-sm font-medium text-gray-700">
          Glissez-déposez vos fichiers ici
        </p>
        <p className="text-xs text-gray-400 mt-1">
          ou cliquez pour sélectionner — PDF, Word, images (max 20 Mo)
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
          onChange={e => e.target.files && addFiles(Array.from(e.target.files))}
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((uf, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-lg border text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{uf.file.name}</p>
                <p className="text-xs text-gray-400">{formatSize(uf.file.size)}</p>
              </div>
              {uf.status === 'uploading' && <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />}
              {uf.status === 'done' && <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />}
              {uf.status === 'error' && (
                <div className="flex items-center gap-1 text-red-500">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs">{uf.error}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
