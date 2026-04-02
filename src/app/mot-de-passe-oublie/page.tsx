'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Mail } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })

    if (error) {
      setError(`Erreur : ${error.message}`)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <div className="h-screen flex overflow-hidden" style={{ background: '#F5F5F5' }}>

      {/* Panneau gauche — branding */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: 'linear-gradient(135deg, #001AB3 0%, #204ce5 60%, #527EFF 100%)' }}
      >
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '10px' }} className="w-10 h-10 flex items-center justify-center">
              <span style={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '16px' }}>CU</span>
            </div>
            <span style={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px' }}>
              Cr&eacute;dit Unique
            </span>
          </div>

          <h1 style={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '36px', lineHeight: 1.2 }} className="mb-6">
            R&eacute;initialisez votre<br />mot de passe
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontFamily: 'Open Sans, sans-serif', fontSize: '16px', lineHeight: 1.7 }}>
            Entrez votre adresse email pour recevoir un lien de r&eacute;initialisation.
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
          <div className="flex items-center gap-2 mb-10 lg:hidden justify-center">
            <div style={{ background: '#204ce5', borderRadius: '8px' }} className="w-9 h-9 flex items-center justify-center">
              <span style={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '14px' }}>CU</span>
            </div>
            <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '18px', color: '#112337' }}>Cr&eacute;dit Unique</span>
          </div>

          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 24px rgba(32,76,229,0.08)', padding: '40px' }}>
            <div className="flex items-center gap-3 mb-8">
              <div style={{ background: '#EEF2FF', borderRadius: '10px' }} className="w-10 h-10 flex items-center justify-center">
                <Mail className="h-5 w-5" style={{ color: '#204ce5' }} />
              </div>
              <div>
                <h2 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '20px', color: '#112337' }}>
                  Mot de passe oubli&eacute;
                </h2>
                <p style={{ fontFamily: 'Open Sans, sans-serif', fontSize: '13px', color: '#585e6a' }}>
                  Recevez un lien de r&eacute;initialisation
                </p>
              </div>
            </div>

            {success ? (
              <div>
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '16px', fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#16A34A', marginBottom: '20px' }}>
                  Un email de r&eacute;initialisation vous a &eacute;t&eacute; envoy&eacute;. V&eacute;rifiez votre bo&icirc;te de r&eacute;ception.
                </div>
                <Link
                  href="/login"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '14px',
                    color: '#204ce5',
                  }}
                >
                  Retour &agrave; la connexion
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label style={{ fontFamily: 'Open Sans, sans-serif', fontWeight: 600, fontSize: '13px', color: '#112337', display: 'block', marginBottom: '6px' }}>
                    Adresse email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="vous@exemple.fr"
                    required
                    autoComplete="email"
                    style={{
                      width: '100%', padding: '10px 14px',
                      border: '1.5px solid #EBEBEB', borderRadius: '8px',
                      fontFamily: 'Open Sans, sans-serif', fontSize: '14px', color: '#112337',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = '#204ce5'}
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
                    background: loading ? '#93A3D4' : '#204ce5',
                    color: '#fff', border: 'none', borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Envoyer le lien
                </button>

                <Link
                  href="/login"
                  style={{
                    display: 'block',
                    textAlign: 'center',
                    fontFamily: 'Open Sans, sans-serif',
                    fontSize: '13px',
                    color: '#204ce5',
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
