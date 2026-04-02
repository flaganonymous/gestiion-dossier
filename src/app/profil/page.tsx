'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Navbar } from '@/components/navbar'
import { Profile, ROLE_LABELS } from '@/lib/supabase/types'
import { Loader2, User, KeyRound, Pencil, Check, X } from 'lucide-react'

export default function ProfilPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')

  // Password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    async function loadProfile() {
      const res = await fetch('/api/auth/me')
      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
        setNom(data.profile.nom)
        setPrenom(data.profile.prenom)
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  async function handleSaveProfile() {
    setProfileError('')
    setProfileMessage('')
    setSavingProfile(true)

    const res = await fetch('/api/profil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, prenom }),
    })

    if (!res.ok) {
      const data = await res.json()
      setProfileError(data.error || 'Erreur lors de la mise à jour')
      setSavingProfile(false)
      return
    }

    const data = await res.json()
    setProfile(data.profile)
    setProfileMessage('Profil mis à jour avec succès')
    setEditing(false)
    setSavingProfile(false)
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (newPassword.length < 8) {
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas.')
      return
    }

    setSavingPassword(true)

    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setPasswordError(`Erreur : ${error.message}`)
      setSavingPassword(false)
      return
    }

    setPasswordMessage('Mot de passe modifié avec succès')
    setNewPassword('')
    setConfirmPassword('')
    setSavingPassword(false)
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#F5F5F5' }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#204ce5' }} />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#F5F5F5' }}>
        <p style={{ fontFamily: 'Open Sans, sans-serif', color: '#585e6a' }}>Impossible de charger le profil.</p>
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    border: '1.5px solid #EBEBEB',
    borderRadius: '8px',
    fontFamily: 'Open Sans, sans-serif',
    fontSize: '14px',
    color: '#112337',
    outline: 'none',
    transition: 'border-color 0.2s',
    background: '#fff',
  }

  const inputDisabledStyle: React.CSSProperties = {
    ...inputStyle,
    background: '#F5F5F5',
    color: '#585e6a',
    cursor: 'not-allowed',
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Open Sans, sans-serif',
    fontWeight: 600,
    fontSize: '13px',
    color: '#112337',
    display: 'block',
    marginBottom: '6px',
  }

  return (
    <div style={{ background: '#F5F5F5', minHeight: '100vh' }}>
      <Navbar profile={profile} />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px', color: '#112337', marginBottom: '24px' }}>
          Mon profil
        </h1>

        {/* Informations personnelles */}
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(32,76,229,0.08)', padding: '32px', marginBottom: '24px' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div style={{ background: '#EEF2FF', borderRadius: '10px' }} className="w-10 h-10 flex items-center justify-center">
                <User className="h-5 w-5" style={{ color: '#204ce5' }} />
              </div>
              <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px', color: '#112337' }}>
                Informations personnelles
              </h2>
            </div>
            {!editing ? (
              <button
                onClick={() => { setEditing(true); setProfileMessage(''); setProfileError('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '8px',
                  border: '1.5px solid #EBEBEB', background: '#fff',
                  fontFamily: 'Open Sans, sans-serif', fontSize: '13px', fontWeight: 600,
                  color: '#204ce5', cursor: 'pointer',
                }}
              >
                <Pencil className="h-4 w-4" />
                Modifier
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '8px',
                    border: 'none', background: '#204ce5',
                    fontFamily: 'Open Sans, sans-serif', fontSize: '13px', fontWeight: 600,
                    color: '#fff', cursor: savingProfile ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Enregistrer
                </button>
                <button
                  onClick={() => { setEditing(false); setNom(profile.nom); setPrenom(profile.prenom); setProfileError('') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 16px', borderRadius: '8px',
                    border: '1.5px solid #EBEBEB', background: '#fff',
                    fontFamily: 'Open Sans, sans-serif', fontSize: '13px', fontWeight: 600,
                    color: '#585e6a', cursor: 'pointer',
                  }}
                >
                  <X className="h-4 w-4" />
                  Annuler
                </button>
              </div>
            )}
          </div>

          {profileMessage && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#16A34A', marginBottom: '16px' }}>
              {profileMessage}
            </div>
          )}

          {profileError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626', marginBottom: '16px' }}>
              {profileError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Pr&eacute;nom</label>
              <input
                type="text"
                value={prenom}
                onChange={e => setPrenom(e.target.value)}
                disabled={!editing}
                style={editing ? inputStyle : inputDisabledStyle}
                onFocus={e => { if (editing) e.target.style.borderColor = '#204ce5' }}
                onBlur={e => e.target.style.borderColor = '#EBEBEB'}
              />
            </div>
            <div>
              <label style={labelStyle}>Nom</label>
              <input
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value)}
                disabled={!editing}
                style={editing ? inputStyle : inputDisabledStyle}
                onFocus={e => { if (editing) e.target.style.borderColor = '#204ce5' }}
                onBlur={e => e.target.style.borderColor = '#EBEBEB'}
              />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={profile.email}
                disabled
                style={inputDisabledStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>R&ocirc;le</label>
              <input
                type="text"
                value={ROLE_LABELS[profile.role]}
                disabled
                style={inputDisabledStyle}
              />
            </div>
          </div>
        </div>

        {/* Changer le mot de passe */}
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(32,76,229,0.08)', padding: '32px' }}>
          <div className="flex items-center gap-3 mb-6">
            <div style={{ background: '#EEF2FF', borderRadius: '10px' }} className="w-10 h-10 flex items-center justify-center">
              <KeyRound className="h-5 w-5" style={{ color: '#204ce5' }} />
            </div>
            <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px', color: '#112337' }}>
              Changer le mot de passe
            </h2>
          </div>

          {passwordMessage && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#16A34A', marginBottom: '16px' }}>
              {passwordMessage}
            </div>
          )}

          {passwordError && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626', marginBottom: '16px' }}>
              {passwordError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4" style={{ maxWidth: '400px' }}>
            <div>
              <label style={labelStyle}>Nouveau mot de passe</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#204ce5'}
                onBlur={e => e.target.style.borderColor = '#EBEBEB'}
              />
            </div>
            <div>
              <label style={labelStyle}>Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#204ce5'}
                onBlur={e => e.target.style.borderColor = '#EBEBEB'}
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              style={{
                padding: '10px 24px',
                background: savingPassword ? '#93A3D4' : '#204ce5',
                color: '#fff', border: 'none', borderRadius: '8px',
                fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                cursor: savingPassword ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
              Modifier le mot de passe
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
