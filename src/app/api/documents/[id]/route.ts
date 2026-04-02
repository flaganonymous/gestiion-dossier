import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDownloadPresignedUrl, getPreviewPresignedUrl, deleteS3Object } from '@/lib/s3'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const isPreview = req.nextUrl.searchParams.get('preview') === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: doc } = await supabase
    .from('documents')
    .select('s3_key, nom_fichier, type_mime')
    .eq('id', id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  const url = isPreview
    ? await getPreviewPresignedUrl(doc.s3_key, doc.type_mime || 'application/octet-stream')
    : await getDownloadPresignedUrl(doc.s3_key, doc.nom_fichier)

  return NextResponse.json({ url })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'collaborateur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const { data: doc } = await supabase
    .from('documents')
    .select('s3_key')
    .eq('id', id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })

  await deleteS3Object(doc.s3_key)
  await supabase.from('documents').delete().eq('id', id)

  return NextResponse.json({ ok: true })
}
