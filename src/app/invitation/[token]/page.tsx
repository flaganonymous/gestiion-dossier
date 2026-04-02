'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle, XCircle, Lock } from 'lucide-react'

type PageState = 'loading' | 'invalid' | 'form' | 'success'

export default function InvitationPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [state, setState] = useState<PageState>('loading')
  const [prenom, setPrenom] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch(`/api/invitation/verify?token=${token}`)
        const data = await res.json()
        if (data.valid) {
          setPrenom(data.prenom)
          setState('form')
        } else {
          setErrorMessage(data.error || 'Invitation invalide')
          setState('invalid')
        }
      } catch {
        setErrorMessage('Erreur de connexion au serveur')
        setState('invalid')
      }
    }
    verify()
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    if (password.length < 8) {
      setFormError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (password !== confirmPassword) {
      setFormError('Les mots de passe ne correspondent pas')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/invitation/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (data.success) {
        setState('success')
      } else {
        setFormError(data.error || 'Erreur lors de l\'activation')
      }
    } catch {
      setFormError('Erreur de connexion au serveur')
    } finally {
      setSubmitting(false)
    }
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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#F5F5F5' }}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div
            style={{ background: '#EE7D07', borderRadius: '8px' }}
            className="w-9 h-9 flex items-center justify-center"
          >
            <span
              style={{
                color: '#fff',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '14px',
              }}
            >
              CU
            </span>
          </div>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '18px',
              color: '#112337',
            }}
          >
            Crédit Unique
          </span>
        </div>

        <div
          style={{
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(238,125,7,0.08)',
            padding: '40px',
          }}
        >
          {/* Loading state */}
          {state === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2
                className="h-8 w-8 animate-spin"
                style={{ color: '#EE7D07' }}
              />
              <p
                style={{
                  fontFamily: 'Open Sans, sans-serif',
                  fontSize: '14px',
                  color: '#585e6a',
                }}
              >
                Vérification de votre invitation...
              </p>
            </div>
          )}

          {/* Invalid state */}
          {state === 'invalid' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div
                style={{
                  background: '#FEF2F2',
                  borderRadius: '50%',
                  width: '56px',
                  height: '56px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <XCircle className="h-7 w-7" style={{ color: '#DC2626' }} />
              </div>
              <div className="text-center">
                <h2
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 700,
                    fontSize: '18px',
                    color: '#112337',
                    marginBottom: '8px',
                  }}
                >
                  Invitation invalide
                </h2>
                <p
                  style={{
                    fontFamily: 'Open Sans, sans-serif',
                    fontSize: '14px',
                    color: '#585e6a',
                    marginBottom: '16px',
                  }}
                >
                  {errorMessage}
                </p>
                <a
                  href="mailto:support@creditunique.fr"
                  style={{
                    fontFamily: 'Open Sans, sans-serif',
                    fontSize: '13px',
                    color: '#EE7D07',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Contacter le support
                </a>
              </div>
            </div>
          )}

          {/* Form state */}
          {state === 'form' && (
            <>
              <div className="flex items-center gap-3 mb-8">
                <div
                  style={{ background: '#FFF5EB', borderRadius: '10px' }}
                  className="w-10 h-10 flex items-center justify-center"
                >
                  <Lock className="h-5 w-5" style={{ color: '#EE7D07' }} />
                </div>
                <div>
                  <h2
                    style={{
                      fontFamily: 'Poppins, sans-serif',
                      fontWeight: 700,
                      fontSize: '20px',
                      color: '#112337',
                    }}
                  >
                    Bienvenue {prenom} !
                  </h2>
                  <p
                    style={{
                      fontFamily: 'Open Sans, sans-serif',
                      fontSize: '13px',
                      color: '#585e6a',
                    }}
                  >
                    Choisissez votre mot de passe pour activer votre compte
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label style={labelStyle}>Mot de passe</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Minimum 8 caractères"
                    autoComplete="new-password"
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.target.style.borderColor = '#EE7D07')
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = '#EBEBEB')
                    }
                  />
                </div>

                <div>
                  <label style={labelStyle}>Confirmer le mot de passe</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Retapez votre mot de passe"
                    autoComplete="new-password"
                    style={inputStyle}
                    onFocus={(e) =>
                      (e.target.style.borderColor = '#EE7D07')
                    }
                    onBlur={(e) =>
                      (e.target.style.borderColor = '#EBEBEB')
                    }
                  />
                </div>

                {formError && (
                  <div
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      borderRadius: '8px',
                      padding: '12px',
                      fontFamily: 'Open Sans, sans-serif',
                      fontSize: '13px',
                      color: '#DC2626',
                    }}
                  >
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: submitting ? '#F5B86C' : '#EE7D07',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Activer mon compte
                </button>
              </form>
            </>
          )}

          {/* Success state */}
          {state === 'success' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div
                style={{
                  background: '#F0FDF4',
                  borderRadius: '50%',
                  width: '56px',
                  height: '56px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle
                  className="h-7 w-7"
                  style={{ color: '#16A34A' }}
                />
              </div>
              <div className="text-center">
                <h2
                  style={{
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 700,
                    fontSize: '18px',
                    color: '#112337',
                    marginBottom: '8px',
                  }}
                >
                  Votre compte a été activé !
                </h2>
                <p
                  style={{
                    fontFamily: 'Open Sans, sans-serif',
                    fontSize: '14px',
                    color: '#585e6a',
                    marginBottom: '20px',
                  }}
                >
                  Vous pouvez maintenant vous connecter avec votre adresse email
                  et le mot de passe que vous venez de définir.
                </p>
                <button
                  onClick={() => router.push('/login')}
                  style={{
                    padding: '10px 24px',
                    background: '#EE7D07',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  Se connecter
                </button>
              </div>
            </div>
          )}
        </div>

        <p
          style={{
            textAlign: 'center',
            marginTop: '24px',
            fontFamily: 'Open Sans, sans-serif',
            fontSize: '12px',
            color: '#585e6a',
          }}
        >
          © {new Date().getFullYear()} Crédit Unique
        </p>
      </div>
    </div>
  )
}
