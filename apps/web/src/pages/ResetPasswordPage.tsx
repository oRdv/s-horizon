import type { FormEvent } from 'react'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { BrandIcon } from '@/components/BrandIcon'
import { BrandMark } from '@/components/BrandMark'
import { PasswordField } from '@/components/PasswordField'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { useToastStore } from '@/store/useToastStore'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const addToast = useToastStore((state) => state.addToast)
  const initialEmail =
    typeof location.state === 'object' &&
    location.state !== null &&
    'email' in location.state &&
    typeof location.state.email === 'string'
      ? location.state.email
      : ''
  const [email, setEmail] = useState(initialEmail)
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const normalizedEmail = email.trim()
    const normalizedToken = token.replace(/\D/g, '').slice(0, 6)

    if (!normalizedEmail || normalizedToken.length !== 6 || !password || !passwordConfirmation) {
      const message = 'Informe e-mail, código de 6 números e a nova senha.'
      setError(message)
      addToast({ tone: 'error', title: 'Dados incompletos', description: message })
      setIsSubmitting(false)
      return
    }

    if (password.length < 8) {
      const message = 'A senha precisa ter pelo menos 8 caracteres.'
      setError(message)
      addToast({ tone: 'error', title: 'Senha curta', description: message })
      setIsSubmitting(false)
      return
    }

    if (password !== passwordConfirmation) {
      const message = 'A confirmação da senha não confere.'
      setError(message)
      addToast({ tone: 'error', title: 'Senhas diferentes', description: message })
      setIsSubmitting(false)
      return
    }

    try {
      const responseMessage = await authService.resetPassword({
        email: normalizedEmail,
        token: normalizedToken,
        password,
        password_confirmation: passwordConfirmation,
      })

      addToast({
        tone: 'success',
        title: 'Senha redefinida',
        description: responseMessage,
      })
      navigate('/login', { replace: true })
    } catch (requestError: unknown) {
      const message = getApiErrorMessage(requestError, 'Não foi possível redefinir a senha.')
      setError(message)
      addToast({ tone: 'error', title: 'Redefinição falhou', description: message })
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
              <h1>Nova senha</h1>
              <p>Use o código recebido por e-mail e escolha uma senha segura.</p>
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

              <div className="form-group">
                <input
                  autoComplete="one-time-code"
                  className="simple-input"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Código de 6 números"
                  value={token}
                />
              </div>

              <div className="form-group">
                <PasswordField
                  autoComplete="new-password"
                  className="simple-input"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nova senha"
                  value={password}
                />
              </div>

              <div className="form-group">
                <PasswordField
                  autoComplete="new-password"
                  className="simple-input"
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  placeholder="Confirmar nova senha"
                  value={passwordConfirmation}
                />
              </div>

              {error ? <p className="form-error">{error}</p> : null}

              <button className="login-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Redefinindo...' : 'Redefinir senha'}
                {!isSubmitting && <ArrowRight size={18} strokeWidth={2} />}
              </button>
            </form>

            <p className="signup-link">
              Não recebeu? <Link to="/forgot-password">Solicitar novo código</Link>
            </p>
            <p className="signup-link">
              Voltar para <Link to="/login">login</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
