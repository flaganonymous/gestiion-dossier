'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, KeyRound } from 'lucide-react'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(`Erreur : ${error.message}`)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)

    setTimeout(() => {
      window.location.href = '/login'
    }, 2000)
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#F5F5F5' }}>

      {/* Panneau gauche — branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: 'linear-gradient(135deg, #0E1520 0%, #1a2332 60%, #243040 100%)' }}
      >
        <div>
          <div className="flex items-center gap-1 mb-16">
            <span style={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 300, fontSize: '22px', letterSpacing: '1.5px' }}>CRÉDIT</span>
            <span style={{ color: '#EE7D07', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '22px', letterSpacing: '1.5px' }}>UN1QUE</span>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Open Sans, sans-serif', fontSize: '11px', alignSelf: 'flex-end', lineHeight: '2.2' }}>.COM</span>
          </div>

          <h1 style={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '36px', lineHeight: 1.2 }} className="mb-6">
            Nouveau mot<br />de passe
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'Open Sans, sans-serif', fontSize: '16px', lineHeight: 1.7 }}>
            Choisissez un nouveau mot de passe s&eacute;curis&eacute; pour votre compte.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Dossiers gérés', value: '500+' },
            { label: 'Apporteurs', value: '50+' },
            { label: 'Taux de satisfaction', value: '98%' },
          ].map(stat => (
            <div key={stat.label} style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} className="p-4">
              <p style={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '24px' }}>{stat.value}</p>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontFamily: 'Open Sans, sans-serif', fontSize: '12px' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Panneau droit — formulaire */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">

          {/* Logo mobile */}
          <div className="flex items-center gap-1 mb-10 lg:hidden justify-center">
            <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 300, fontSize: '20px', color: '#0E1520', letterSpacing: '1px' }}>CRÉDIT</span>
            <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#0E1520', letterSpacing: '1px' }}>UN1QUE</span>
            <span style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '10px', color: '#585e6a', alignSelf: 'flex-end', lineHeight: '2.2' }}>.COM</span>
          </div>

          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(238,125,7,0.08)', padding: '40px' }}>
            <div className="flex items-center gap-3 mb-8">
              <div style={{ background: '#FFF5EB', borderRadius: '10px' }} className="w-10 h-10 flex items-center justify-center">
                <KeyRound className="h-5 w-5" style={{ color: '#EE7D07' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337' }}>
                  Nouveau mot de passe
                </h2>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                  Minimum 8 caract&egrave;res
                </p>
              </div>
            </div>

            {success ? (
              <div>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '16px', fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#16A34A', marginBottom: '20px' }}>
                  Votre mot de passe a &eacute;t&eacute; modifi&eacute; avec succ&egrave;s. Redirection vers la connexion...
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '1.5px solid #EBEBEB', borderRadius: '8px',
                      fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#112337',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#EE7D07'}
                    onBlur={e => e.target.style.borderColor = '#EBEBEB'}
                  />
                </div>

                <div>
                  <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '1.5px solid #EBEBEB', borderRadius: '8px',
                      fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#112337',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#EE7D07'}
                    onBlur={e => e.target.style.borderColor = '#EBEBEB'}
                  />
                </div>

                {error && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px', fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#DC2626' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '12px',
                    background: loading ? '#F5B86C' : '#EE7D07',
                    color: '#fff', border: 'none', borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  R&eacute;initialiser le mot de passe
                </button>

                <Link
                  href="/login"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    fontFamily: 'Open Sans, sans-serif',
                    fontSize: '13px',
                    color: '#EE7D07',
                    fontWeight: 600,
                    marginTop: '8px',
                  }}
                >
                  Retour &agrave; la connexion
                </Link>
              </form>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: '24px', fontFamily: 'Open Sans, sans-serif', fontSize: '12px', color: '#585e6a' }}>
            &copy; {new Date().getFullYear()} Cr&eacute;dit Unique — Acc&egrave;s r&eacute;serv&eacute; aux collaborateurs autoris&eacute;s
          </p>
        </div>
      </div>
    </div>
  )
}
