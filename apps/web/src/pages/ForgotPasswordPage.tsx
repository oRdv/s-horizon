import type { FormEvent } from 'react'
import { useState } from 'react'
import { ArrowRight, MailCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { BrandIcon } from '@/components/BrandIcon'
import { BrandMark } from '@/components/BrandMark'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { useToastStore } from '@/store/useToastStore'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const addToast = useToastStore((state) => state.addToast)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      const nextError = 'Informe seu e-mail para receber o código.'
      setError(nextError)
      addToast({ tone: 'error', title: 'E-mail obrigatório', description: nextError })
      setIsSubmitting(false)
      return
    }

    try {
      const responseMessage = await authService.requestPasswordReset(normalizedEmail)
      setMessage(responseMessage)
      addToast({
        tone: 'success',
        title: 'Código solicitado',
        description: responseMessage,
      })
      navigate('/reset-password', { state: { email: normalizedEmail } })
    } catch (requestError: unknown) {
      const nextError = getApiErrorMessage(requestError, 'Não foi possível solicitar a redefinição de senha.')
      setError(nextError)
      addToast({ tone: 'error', title: 'Falha ao enviar código', description: nextError })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-background" aria-hidden="true">
        <div className="visual-orb visual-orb--one" />
        <div className="visual-orb visual-orb--two" />
        <div className="visual-orb visual-orb--three" />
        <div className="visual-grid" />
      </div>

      <div className="login-container">
        <header className="login-header">
          <div className="login-header__brand">
            <BrandMark />
          </div>
        </header>

        <main className="login-main">
          <div className="login-content">
            <div className="login-intro">
              <div className="login-logo">
                <BrandIcon className="login-logo__image" size={96} />
              </div>
              <h1>Recuperar senha</h1>
              <p>Receba um código por e-mail para criar uma nova senha de acesso.</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <input
                  autoComplete="email"
                  className="simple-input"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="E-mail"
                  type="email"
                  value={email}
                />
              </div>

              {error ? <p className="form-error">{error}</p> : null}
              {message ? (
                <p className="form-success">
                  <MailCheck size={16} />
                  {message}
                </p>
              ) : null}

              <button className="login-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Enviando...' : 'Enviar código'}
                {!isSubmitting && <ArrowRight size={18} strokeWidth={2} />}
              </button>
            </form>

            <p className="signup-link">
              Já tem o código? <Link to="/reset-password">Redefinir senha</Link>
            </p>
            <p className="signup-link">
              Lembrou a senha? <Link to="/login">Entrar</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
