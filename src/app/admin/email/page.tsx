'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/navbar'
import { Profile } from '@/lib/supabase/types'
import { Mail, Plus, Trash2, Check, X, Send, Eye, Pencil, ChevronDown, ChevronUp, Loader2, Server } from 'lucide-react'

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
  created_at: string
}

interface EmailTemplate {
  id: string
  slug: string
  nom: string
  sujet: string
  corps_html: string
  corps_texte: string
  variables: string[]
  actif: boolean
}

const PROVIDER_LABELS: Record<string, string> = {
  brevo: 'Brevo',
  mautic: 'Mautic',
  ses: 'AWS SES',
  custom: 'Personnalise',
}

const PROVIDER_COLORS: Record<string, { bg: string; color: string }> = {
  brevo: { bg: '#FFF5EB', color: '#EE7D07' },
  mautic: { bg: '#DCFCE7', color: '#16a34a' },
  ses: { bg: '#FEF3C7', color: '#d97706' },
  custom: { bg: '#F5F5F5', color: '#585e6a' },
}

const PROVIDER_DEFAULTS: Record<string, { host: string; port: number }> = {
  brevo: { host: 'smtp-relay.brevo.com', port: 587 },
  mautic: { host: '', port: 587 },
  ses: { host: 'email-smtp.eu-west-1.amazonaws.com', port: 587 },
  custom: { host: '', port: 587 },
}

export default function EmailConfigPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activeTab, setActiveTab] = useState<'smtp' | 'templates'>('smtp')

  // SMTP state
  const [configs, setConfigs] = useState<SmtpConfig[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [smtpForm, setSmtpForm] = useState({
    nom: '',
    provider: 'custom',
    host: '',
    port: 587,
    username: '',
    password: '',
    from_email: '',
    from_name: 'Credit Unique',
    use_tls: true,
  })

  // Templates state
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null)
  const [templateForm, setTemplateForm] = useState({
    nom: '',
    slug: '',
    sujet: '',
    corps_html: '',
    corps_texte: '',
    variables: '' as string,
  })
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setProfile(d.profile))
      .catch(() => { window.location.href = '/login' })
  }, [])

  useEffect(() => {
    if (profile) {
      fetchConfigs()
      fetchTemplates()
    }
  }, [profile])

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000)
      return () => clearTimeout(t)
    }
  }, [toast])

  async function fetchConfigs() {
    const res = await fetch('/api/admin/smtp')
    if (res.ok) setConfigs(await res.json())
  }

  async function fetchTemplates() {
    const res = await fetch('/api/admin/templates')
    if (res.ok) setTemplates(await res.json())
  }

  function handleProviderChange(provider: string) {
    const defaults = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.custom
    setSmtpForm(prev => ({
      ...prev,
      provider,
      host: defaults.host || prev.host,
      port: defaults.port,
    }))
  }

  async function handleSmtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading('smtp-save')

    const url = editingId ? `/api/admin/smtp/${editingId}` : '/api/admin/smtp'
    const method = editingId ? 'PATCH' : 'POST'

    // En edition, si le mot de passe n'a pas ete retape on ne l'envoie
    // pas pour eviter d'ecraser celui stocke en base.
    const payload: Record<string, unknown> = { ...smtpForm }
    if (editingId && !smtpForm.password) delete payload.password

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (res.ok) {
      setToast({ type: 'success', message: editingId ? 'Configuration mise a jour' : 'Configuration creee' })
      setShowForm(false)
      setEditingId(null)
      resetSmtpForm()
      await fetchConfigs()
    } else {
      const data = await res.json()
      setToast({ type: 'error', message: data.error || 'Erreur' })
    }
    setLoading(null)
  }

  function resetSmtpForm() {
    setSmtpForm({
      nom: '',
      provider: 'custom',
      host: '',
      port: 587,
      username: '',
      password: '',
      from_email: '',
      from_name: 'Credit Unique',
      use_tls: true,
    })
  }

  function startEdit(config: SmtpConfig) {
    setEditingId(config.id)
    setSmtpForm({
      nom: config.nom,
      provider: config.provider,
      host: config.host,
      port: config.port,
      username: config.username,
      password: '',
      from_email: config.from_email,
      from_name: config.from_name,
      use_tls: config.use_tls,
    })
    setShowForm(true)
  }

  async function handleTest(configId: string) {
    setLoading(`test-${configId}`)
    const res = await fetch(`/api/admin/smtp/${configId}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: profile?.email || '' }),
    })
    const data = await res.json()
    if (res.ok) {
      setToast({ type: 'success', message: 'Email de test envoye avec succes !' })
    } else {
      setToast({ type: 'error', message: data.error || 'Echec de l\'envoi' })
    }
    setLoading(null)
  }

  async function handleActivate(configId: string) {
    setLoading(`activate-${configId}`)
    const res = await fetch(`/api/admin/smtp/${configId}/activate`, { method: 'POST' })
    if (res.ok) {
      setToast({ type: 'success', message: 'Configuration activee' })
      await fetchConfigs()
    } else {
      const data = await res.json()
      setToast({ type: 'error', message: data.error || 'Erreur' })
    }
    setLoading(null)
  }

  async function handleDelete(configId: string) {
    if (!confirm('Supprimer cette configuration SMTP ?')) return
    setLoading(`delete-${configId}`)
    const res = await fetch(`/api/admin/smtp/${configId}`, { method: 'DELETE' })
    if (res.ok) {
      setToast({ type: 'success', message: 'Configuration supprimee' })
      await fetchConfigs()
    }
    setLoading(null)
  }

  async function handleTemplateUpdate(templateId: string) {
    setLoading(`template-${templateId}`)
    const res = await fetch(`/api/admin/templates/${templateId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nom: templateForm.nom,
        sujet: templateForm.sujet,
        corps_html: templateForm.corps_html,
        corps_texte: templateForm.corps_texte,
        variables: templateForm.variables.split(',').map(v => v.trim()).filter(Boolean),
      }),
    })
    if (res.ok) {
      setToast({ type: 'success', message: 'Modele mis a jour' })
      setEditingTemplate(null)
      await fetchTemplates()
    } else {
      const data = await res.json()
      setToast({ type: 'error', message: data.error || 'Erreur' })
    }
    setLoading(null)
  }

  async function handleTemplateDelete(templateId: string) {
    if (!confirm('Supprimer ce modele d\'email ?')) return
    setLoading(`tpl-delete-${templateId}`)
    const res = await fetch(`/api/admin/templates/${templateId}`, { method: 'DELETE' })
    if (res.ok) {
      setToast({ type: 'success', message: 'Modele supprime' })
      await fetchTemplates()
    }
    setLoading(null)
  }

  function startTemplateEdit(template: EmailTemplate) {
    setEditingTemplate(template.id)
    setTemplateForm({
      nom: template.nom,
      slug: template.slug,
      sujet: template.sujet,
      corps_html: template.corps_html,
      corps_texte: template.corps_texte,
      variables: Array.isArray(template.variables) ? template.variables.join(', ') : '',
    })
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F5F5' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#EE7D07' }} />
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: 'Open Sans, sans-serif',
    fontSize: '14px',
    color: '#112337',
    border: '1px solid #EBEBEB',
    borderRadius: '8px',
    padding: '10px 14px',
    width: '100%',
    outline: 'none',
    background: '#fff',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Open Sans, sans-serif',
    fontSize: '13px',
    fontWeight: 600,
    color: '#112337',
    marginBottom: '4px',
    display: 'block',
  }

  const btnPrimary: React.CSSProperties = {
    background: '#EE7D07',
    color: '#fff',
    fontFamily: 'Poppins, sans-serif',
    fontWeight: 600,
    fontSize: '14px',
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  }

  const btnSecondary: React.CSSProperties = {
    background: '#fff',
    color: '#585e6a',
    fontFamily: 'Open Sans, sans-serif',
    fontWeight: 500,
    fontSize: '13px',
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #EBEBEB',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  }

  const btnDanger: React.CSSProperties = {
    ...btnSecondary,
    color: '#dc2626',
    borderColor: '#FECACA',
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #EBEBEB',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '12px',
  }

  return (
    <div className="min-h-screen" style={{ background: '#F5F5F5' }}>
      <Navbar profile={profile} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Toast */}
        {toast && (
          <div
            style={{
              position: 'fixed',
              top: '80px',
              right: '20px',
              zIndex: 50,
              background: toast.type === 'success' ? '#DCFCE7' : '#FEE2E2',
              color: toast.type === 'success' ? '#16a34a' : '#dc2626',
              border: `1px solid ${toast.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
              borderRadius: '10px',
              padding: '12px 20px',
              fontFamily: 'Open Sans, sans-serif',
              fontSize: '14px',
              fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              maxWidth: '400px',
            }}
          >
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px', color: '#112337' }}>
              Configuration Emails
            </h1>
            <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#585e6a', marginTop: '2px' }}>
              Gerez les configurations SMTP et les modeles d'email
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6" style={{ background: '#fff', borderRadius: '10px', padding: '4px', border: '1px solid #EBEBEB', display: 'inline-flex' }}>
          <button
            onClick={() => setActiveTab('smtp')}
            style={{
              fontFamily: 'Open Sans, sans-serif',
              fontSize: '14px',
              fontWeight: activeTab === 'smtp' ? 600 : 400,
              color: activeTab === 'smtp' ? '#EE7D07' : '#585e6a',
              background: activeTab === 'smtp' ? '#FFF5EB' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Server className="h-4 w-4" />
            Configuration SMTP
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            style={{
              fontFamily: 'Open Sans, sans-serif',
              fontSize: '14px',
              fontWeight: activeTab === 'templates' ? 600 : 400,
              color: activeTab === 'templates' ? '#EE7D07' : '#585e6a',
              background: activeTab === 'templates' ? '#FFF5EB' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Mail className="h-4 w-4" />
            Modeles d'email
          </button>
        </div>

        {/* SMTP Tab */}
        {activeTab === 'smtp' && (
          <div>
            {!showForm && (
              <div className="mb-4">
                <button
                  style={btnPrimary}
                  onClick={() => { resetSmtpForm(); setEditingId(null); setShowForm(true) }}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter une configuration
                </button>
              </div>
            )}

            {/* SMTP Form */}
            {showForm && (
              <div style={{ ...cardStyle, marginBottom: '20px' }}>
                <h3 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '16px', color: '#112337', marginBottom: '16px' }}>
                  {editingId ? 'Modifier la configuration' : 'Nouvelle configuration SMTP'}
                </h3>
                <form onSubmit={handleSmtpSubmit}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>Nom</label>
                      <input
                        style={inputStyle}
                        value={smtpForm.nom}
                        onChange={e => setSmtpForm(p => ({ ...p, nom: e.target.value }))}
                        placeholder="Ex: Brevo Production"
                        required
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Fournisseur</label>
                      <select
                        style={inputStyle}
                        value={smtpForm.provider}
                        onChange={e => handleProviderChange(e.target.value)}
                      >
                        <option value="brevo">Brevo</option>
                        <option value="mautic">Mautic</option>
                        <option value="ses">AWS SES</option>
                        <option value="custom">Personnalise</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Host</label>
                      <input
                        style={inputStyle}
                        value={smtpForm.host}
                        onChange={e => setSmtpForm(p => ({ ...p, host: e.target.value }))}
                        placeholder="smtp.example.com"
                        required
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Port</label>
                      <input
                        style={inputStyle}
                        type="number"
                        value={smtpForm.port}
                        onChange={e => setSmtpForm(p => ({ ...p, port: parseInt(e.target.value) || 587 }))}
                        required
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Identifiant SMTP</label>
                      <input
                        style={inputStyle}
                        value={smtpForm.username}
                        onChange={e => setSmtpForm(p => ({ ...p, username: e.target.value }))}
                        placeholder="username"
                        required
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Mot de passe SMTP</label>
                      <input
                        style={inputStyle}
                        type="password"
                        value={smtpForm.password}
                        onChange={e => setSmtpForm(p => ({ ...p, password: e.target.value }))}
                        placeholder={editingId ? '(inchange si vide)' : 'mot de passe'}
                        required={!editingId}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Email d'expedition</label>
                      <input
                        style={inputStyle}
                        type="email"
                        value={smtpForm.from_email}
                        onChange={e => setSmtpForm(p => ({ ...p, from_email: e.target.value }))}
                        placeholder="noreply@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Nom d'expedition</label>
                      <input
                        style={inputStyle}
                        value={smtpForm.from_name}
                        onChange={e => setSmtpForm(p => ({ ...p, from_name: e.target.value }))}
                        placeholder="Credit Unique"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={smtpForm.use_tls}
                        onChange={e => setSmtpForm(p => ({ ...p, use_tls: e.target.checked }))}
                        style={{ width: '16px', height: '16px', accentColor: '#EE7D07' }}
                      />
                      Utiliser TLS
                    </label>
                  </div>
                  <div className="mt-6 flex gap-3">
                    <button type="submit" style={btnPrimary} disabled={loading === 'smtp-save'}>
                      {loading === 'smtp-save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      {editingId ? 'Mettre a jour' : 'Creer'}
                    </button>
                    <button
                      type="button"
                      style={btnSecondary}
                      onClick={() => { setShowForm(false); setEditingId(null); resetSmtpForm() }}
                    >
                      <X className="h-4 w-4" />
                      Annuler
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* SMTP Config List */}
            {configs.length === 0 && !showForm && (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '40px' }}>
                <Server className="h-12 w-12 mx-auto mb-3" style={{ color: '#EBEBEB' }} />
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '15px', color: '#585e6a' }}>
                  Aucune configuration SMTP
                </p>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a', marginTop: '4px' }}>
                  Ajoutez une configuration pour envoyer des emails
                </p>
              </div>
            )}

            {configs.map(config => (
              <div key={config.id} style={cardStyle}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: PROVIDER_COLORS[config.provider]?.bg || '#F5F5F5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Server className="h-5 w-5" style={{ color: PROVIDER_COLORS[config.provider]?.color || '#585e6a' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
                          {config.nom}
                        </span>
                        <span
                          style={{
                            background: PROVIDER_COLORS[config.provider]?.bg || '#F5F5F5',
                            color: PROVIDER_COLORS[config.provider]?.color || '#585e6a',
                            fontSize: '11px',
                            fontWeight: 600,
                            fontFamily: 'Open Sans, sans-serif',
                            padding: '2px 10px',
                            borderRadius: '20px',
                          }}
                        >
                          {PROVIDER_LABELS[config.provider] || config.provider}
                        </span>
                        {config.actif && (
                          <span
                            style={{
                              background: '#DCFCE7',
                              color: '#16a34a',
                              fontSize: '11px',
                              fontWeight: 600,
                              fontFamily: 'Open Sans, sans-serif',
                              padding: '2px 10px',
                              borderRadius: '20px',
                            }}
                          >
                            Actif
                          </span>
                        )}
                      </div>
                      <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a', marginTop: '2px' }}>
                        {config.host}:{config.port} &middot; {config.from_email}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4 flex-wrap">
                  <button
                    style={btnSecondary}
                    onClick={() => handleTest(config.id)}
                    disabled={loading === `test-${config.id}`}
                  >
                    {loading === `test-${config.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    Tester
                  </button>
                  {!config.actif && (
                    <button
                      style={{ ...btnSecondary, color: '#16a34a', borderColor: '#BBF7D0' }}
                      onClick={() => handleActivate(config.id)}
                      disabled={loading === `activate-${config.id}`}
                    >
                      {loading === `activate-${config.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Activer
                    </button>
                  )}
                  <button
                    style={btnSecondary}
                    onClick={() => startEdit(config)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Modifier
                  </button>
                  <button
                    style={btnDanger}
                    onClick={() => handleDelete(config.id)}
                    disabled={loading === `delete-${config.id}`}
                  >
                    {loading === `delete-${config.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div>
            {templates.length === 0 && (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '40px' }}>
                <Mail className="h-12 w-12 mx-auto mb-3" style={{ color: '#EBEBEB' }} />
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '15px', color: '#585e6a' }}>
                  Aucun modele d'email
                </p>
              </div>
            )}

            {templates.map(template => (
              <div key={template.id} style={cardStyle}>
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedTemplate(expandedTemplate === template.id ? null : template.id)}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '15px', color: '#112337' }}>
                        {template.nom}
                      </span>
                      <span
                        style={{
                          background: '#F5F5F5',
                          color: '#585e6a',
                          fontSize: '11px',
                          fontWeight: 500,
                          fontFamily: 'monospace',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        {template.slug}
                      </span>
                    </div>
                    <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a', marginTop: '2px' }}>
                      {template.sujet}
                    </p>
                  </div>
                  {expandedTemplate === template.id ? (
                    <ChevronUp className="h-5 w-5" style={{ color: '#585e6a' }} />
                  ) : (
                    <ChevronDown className="h-5 w-5" style={{ color: '#585e6a' }} />
                  )}
                </div>

                {expandedTemplate === template.id && (
                  <div className="mt-4" style={{ borderTop: '1px solid #EBEBEB', paddingTop: '16px' }}>
                    {editingTemplate === template.id ? (
                      <div>
                        <div className="grid grid-cols-1 gap-4 mb-4">
                          <div>
                            <label style={labelStyle}>Nom</label>
                            <input
                              style={inputStyle}
                              value={templateForm.nom}
                              onChange={e => setTemplateForm(p => ({ ...p, nom: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Sujet</label>
                            <input
                              style={inputStyle}
                              value={templateForm.sujet}
                              onChange={e => setTemplateForm(p => ({ ...p, sujet: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Corps HTML</label>
                            <textarea
                              style={{ ...inputStyle, minHeight: '200px', fontFamily: 'monospace', fontSize: '12px' }}
                              value={templateForm.corps_html}
                              onChange={e => setTemplateForm(p => ({ ...p, corps_html: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Corps texte</label>
                            <textarea
                              style={{ ...inputStyle, minHeight: '120px', fontFamily: 'monospace', fontSize: '12px' }}
                              value={templateForm.corps_texte}
                              onChange={e => setTemplateForm(p => ({ ...p, corps_texte: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label style={labelStyle}>Variables (separees par des virgules)</label>
                            <input
                              style={inputStyle}
                              value={templateForm.variables}
                              onChange={e => setTemplateForm(p => ({ ...p, variables: e.target.value }))}
                              placeholder="prenom, nom, lien"
                            />
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            style={btnPrimary}
                            onClick={() => handleTemplateUpdate(template.id)}
                            disabled={loading === `template-${template.id}`}
                          >
                            {loading === `template-${template.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            Enregistrer
                          </button>
                          <button
                            style={btnSecondary}
                            onClick={() => setEditingTemplate(null)}
                          >
                            <X className="h-4 w-4" />
                            Annuler
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {/* Variables list */}
                        <div className="mb-3">
                          <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '12px', fontWeight: 600, color: '#585e6a' }}>
                            Variables :
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(Array.isArray(template.variables) ? template.variables : []).map((v: string) => (
                              <span
                                key={v}
                                style={{
                                  background: '#FFF5EB',
                                  color: '#EE7D07',
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                }}
                              >
                                {'{{' + v + '}}'}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Preview */}
                        {previewTemplate === template.id ? (
                          <div className="mb-3">
                            <div
                              style={{
                                border: '1px solid #EBEBEB',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                background: '#F5F5F5',
                                padding: '16px',
                              }}
                              dangerouslySetInnerHTML={{ __html: template.corps_html }}
                            />
                          </div>
                        ) : null}

                        <div className="flex gap-2">
                          <button
                            style={btnSecondary}
                            onClick={() => setPreviewTemplate(previewTemplate === template.id ? null : template.id)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            {previewTemplate === template.id ? 'Masquer' : 'Apercu'}
                          </button>
                          <button
                            style={btnSecondary}
                            onClick={() => startTemplateEdit(template)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Modifier
                          </button>
                          <button
                            style={btnDanger}
                            onClick={() => handleTemplateDelete(template.id)}
                            disabled={loading === `tpl-delete-${template.id}`}
                          >
                            {loading === `tpl-delete-${template.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            Supprimer
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
