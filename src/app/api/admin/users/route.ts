import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// Créer un utilisateur
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const { email, password, nom, prenom, role } = await req.json()

  if (!email || !nom || !prenom || !role) {
    return NextResponse.json({ error: 'Email, prenom, nom et role sont requis' }, { status: 400 })
  }

  // Pour les admins/collaborateurs, un mot de passe est requis.
  // Pour les clients, le mot de passe est defini via le lien d'invitation,
  // donc on genere un mot de passe aleatoire et on envoie l'email.
  const isClient = role === 'client'
  if (!isClient && !password) {
    return NextResponse.json({ error: 'Mot de passe requis pour les admins et collaborateurs' }, { status: 400 })
  }

  const adminClient = await createAdminClient()
  const cleanEmail = String(email).trim().toLowerCase()
  const effectivePassword = isClient ? crypto.randomUUID() : password

  const { data, error } = await adminClient.auth.admin.createUser({
    email: cleanEmail,
    password: effectivePassword,
    user_metadata: { nom, prenom, role },
    email_confirm: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const newUserId = data.user?.id
  if (!newUserId) return NextResponse.json({ error: 'Creation echouee' }, { status: 500 })

  // Pour les clients : on met actif=false + token d'invitation et on envoie
  // l'email. Le client definira son mot de passe via le lien.
  if (isClient) {
    const invitationToken = crypto.randomUUID()
    const expireAt = new Date(Date.now() + 72 * 60 * 60 * 1000)

    const { error: updateErr } = await adminClient
      .from('profiles')
      .update({
        nom: String(nom).trim(),
        prenom: String(prenom).trim(),
        role: 'client',
        actif: false,
        invitation_token: invitationToken,
        invitation_expire_at: expireAt.toISOString(),
      })
      .eq('id', newUserId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Creation automatique du dossier associe au client.
    // Le client pourra le completer lui-meme apres activation.
    const currentYear = new Date().getFullYear()
    const dossierTitre = `${String(prenom).trim()} ${String(nom).trim()}`.trim()
    const { data: dossierData, error: dossierErr } = await adminClient
      .from('dossiers')
      .insert({
        titre: dossierTitre || cleanEmail,
        annee: currentYear,
        statut: 'en_cours',
        client_id: newUserId,
      })
      .select('id')
      .single()

    if (dossierErr) {
      // Ne pas bloquer la creation du client si le dossier echoue
      console.error('Creation dossier automatique echouee:', dossierErr)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const invitationUrl = `${appUrl}/invitation/${invitationToken}`

    const { sendEmail } = await import('@/lib/email')
    const result = await sendEmail({
      to: cleanEmail,
      templateSlug: 'invitation_client',
      variables: {
        prenom: String(prenom).trim(),
        nom: String(nom).trim(),
        email: cleanEmail,
        lien_invitation: invitationUrl,
      },
    })

    return NextResponse.json({
      id: newUserId,
      invitation_url: invitationUrl,
      dossier_id: dossierData?.id ?? null,
      dossier_error: dossierErr?.message ?? null,
      email_sent: result.success,
      email_error: result.success ? null : (result.error ?? 'Envoi echoue'),
    })
  }

  return NextResponse.json({ id: newUserId })
}

// Lister les utilisateurs
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })
  }

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return NextResponse.json(users ?? [])
}
