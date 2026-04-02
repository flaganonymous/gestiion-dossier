import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  region: process.env.S3_REGION!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.S3_BUCKET_NAME!

/**
 * Construit la clé S3 pour un document
 * Format: {annee}/{apporteur_id}/{dossier_id}/{statut}/{nom_fichier}
 */
export function buildS3Key(params: {
  annee: number
  apporteurId: string
  dossierId: string
  statut: string
  nomFichier: string
}): string {
  const safeName = params.nomFichier.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${params.annee}/${params.apporteurId}/${params.dossierId}/${params.statut}/${safeName}`
}

/**
 * Génère une URL pré-signée pour uploader un fichier directement depuis le navigateur
 */
export async function getUploadPresignedUrl(s3Key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
  })
  return getSignedUrl(s3, command, { expiresIn: 300 }) // 5 minutes
}

/**
 * Génère une URL pré-signée pour télécharger un fichier (expire dans 15 min)
 */
export async function getDownloadPresignedUrl(s3Key: string, nomFichier: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ResponseContentDisposition: `attachment; filename="${nomFichier}"`,
  })
  return getSignedUrl(s3, command, { expiresIn: 900 }) // 15 minutes
}

/**
 * Génère une URL pré-signée pour visualiser un fichier dans le navigateur (inline)
 */
export async function getPreviewPresignedUrl(s3Key: string, contentType: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ResponseContentDisposition: 'inline',
    ResponseContentType: contentType,
  })
  return getSignedUrl(s3, command, { expiresIn: 900 })
}

/**
 * Supprime un fichier de S3
 */
export async function deleteS3Object(s3Key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
  })
  await s3.send(command)
}
