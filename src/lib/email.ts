import nodemailer from 'nodemailer'
import { createAdminClient } from '@/lib/supabase/server'

interface SmtpConfig {
  id: string
  nom: string
  provider: string
  host: string
  port: number
  username: string
  password_encrypted: string
  from_email: string
  from_name: string
  use_tls: boolean
  actif: boolean
}

interface EmailTemplate {
  id: string
  slug: string
  nom: string
  sujet: string
  corps_html: string
  corps_texte: string
  variables: string[]
}

export async function getActiveSmtpConfig(): Promise<SmtpConfig | null> {
  const admin = await createAdminClient()
  const { data } = await admin.from('smtp_config').select('*').eq('actif', true).single()
  return data
}

export async function getEmailTemplate(slug: string): Promise<EmailTemplate | null> {
  const admin = await createAdminClient()
  const { data } = await admin.from('email_templates').select('*').eq('slug', slug).eq('actif', true).single()
  return data
}

function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }
  return result
}

function createTransporter(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.username,
      pass: config.password_encrypted, // In production, decrypt this
    },
    tls: config.use_tls ? { rejectUnauthorized: false } : undefined,
  })
}

async function logEmail(entry: {
  templateSlug: string
  to: string
  sujet: string | null
  dossierId?: string | null
  success: boolean
  erreur?: string | null
}) {
  try {
    const admin = await createAdminClient()
    await admin.from('email_logs').insert({
      template_slug: entry.templateSlug,
      destinataire: entry.to,
      sujet: entry.sujet,
      dossier_id: entry.dossierId ?? null,
      success: entry.success,
      erreur: entry.erreur ?? null,
    })
  } catch (err) {
    console.error('email_logs insert failed:', err)
  }
}

export async function sendEmail(params: {
  to: string
  templateSlug: string
  variables: Record<string, string>
  dossierId?: string | null
}): Promise<{ success: boolean; error?: string }> {
  let renderedSubject: string | null = null
  try {
    const config = await getActiveSmtpConfig()
    if (!config) {
      const error = 'Aucune configuration SMTP active'
      await logEmail({ templateSlug: params.templateSlug, to: params.to, sujet: null, dossierId: params.dossierId, success: false, erreur: error })
      return { success: false, error }
    }

    const template = await getEmailTemplate(params.templateSlug)
    if (!template) {
      const error = `Template "${params.templateSlug}" introuvable`
      await logEmail({ templateSlug: params.templateSlug, to: params.to, sujet: null, dossierId: params.dossierId, success: false, erreur: error })
      return { success: false, error }
    }

    const transporter = createTransporter(config)
    renderedSubject = replaceVariables(template.sujet, params.variables)
    const html = replaceVariables(template.corps_html, params.variables)
    const text = replaceVariables(template.corps_texte, params.variables)

    await transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to: params.to,
      subject: renderedSubject,
      html,
      text,
    })

    await logEmail({ templateSlug: params.templateSlug, to: params.to, sujet: renderedSubject, dossierId: params.dossierId, success: true })
    return { success: true }
  } catch (err: any) {
    console.error('Email send error:', err)
    await logEmail({ templateSlug: params.templateSlug, to: params.to, sujet: renderedSubject, dossierId: params.dossierId, success: false, erreur: err.message })
    return { success: false, error: err.message }
  }
}

export async function sendTestEmail(configId: string, toEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = await createAdminClient()
    const { data: config } = await admin.from('smtp_config').select('*').eq('id', configId).single()
    if (!config) return { success: false, error: 'Configuration introuvable' }

    const transporter = createTransporter(config)
    await transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to: toEmail,
      subject: 'Test SMTP — Crédit Unique',
      html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px;text-align:center"><div style="background:#0E1520;padding:16px;border-radius:10px;margin-bottom:20px"><h2 style="color:#fff;margin:0"><span style="font-weight:300">CRÉDIT</span> <span style="color:#EE7D07;font-weight:700">UN1QUE</span></h2></div><p style="font-size:16px;color:#112337"><strong>Configuration SMTP fonctionnelle !</strong></p><p style="color:#585e6a">Cet email confirme que la configuration <strong>' + config.nom + '</strong> fonctionne correctement.</p><p style="color:#585e6a;font-size:12px;margin-top:30px">Envoyé depuis Crédit Unique — Gestion des dossiers</p></div>',
      text: `Test SMTP — Configuration "${config.nom}" fonctionnelle.\n\nCrédit Unique`,
    })

    return { success: true }
  } catch (err: any) {
    console.error('SMTP test error:', err)
    return { success: false, error: err.message }
  }
}
