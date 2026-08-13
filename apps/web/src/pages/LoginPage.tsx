import type { FormEvent } from 'react'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { BrandIcon } from '@/components/BrandIcon'
import { BrandMark } from '@/components/BrandMark'
import { PasswordField } from '@/components/PasswordField'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService, TwoFactorRequiredError } from '@/services/auth'
import { useToastStore } from '@/store/useToastStore'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const addToast = useToastStore((state) => state.addToast)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function showLoginError(title: string, message: string) {
    setError(message)
    addToast({
      tone: 'error',
      title,
      description: message,
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const normalizedEmail = email.trim()

    if (!normalizedEmail || !password) {
      showLoginError('Dados incompletos', 'Informe e-mail e senha para entrar.')
      setIsSubmitting(false)
      return
    }

    try {
      const user = await authService.login({
        email: normalizedEmail,
        password,
        two_factor_code: requiresTwoFactor ? twoFactorCode : undefined,
      })
      setRequiresTwoFactor(false)
      setTwoFactorCode('')
      navigate(user.email_verified_at ? sanitizeInternalRedirect(searchParams.get('redirect')) ?? '/dashboard' : '/verify-email', { replace: true })
    } catch (error: unknown) {
      if (error instanceof TwoFactorRequiredError) {
        setRequiresTwoFactor(true)
        setTwoFactorCode('')
        addToast({
          tone: 'success',
          title: 'Código enviado',
          description: 'Enviamos o código de autenticação para seu e-mail.',
        })
        return
      }

      const message = getApiErrorMessage(
        error,
        'Não foi possível autenticar. Confira e-mail e senha.',
      )

      showLoginError('Login não concluído', message)
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
              <h1>Horizon Boost</h1>
              <p>
                Entre para acompanhar pedidos, prazos e progresso do seu boost em um
                painel limpo e direto.
              </p>
            </div>

            <div className="auth-benefits" aria-label="Beneficios da Horizon Boost">
              <span>Pedido rastreavel</span>
              <span>Suporte humano</span>
              <span>Entrega combinada</span>
            </div>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <input
                  id="email"
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="E-mail"
                  type="email"
                  value={email}
                  className="simple-input"
                />
              </div>

              <div className="form-group">
                <PasswordField
                  id="password"
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Senha"
                  value={password}
                  className="simple-input"
                  isAdmin={email.trim().toLowerCase() === 'boosthorizon@gmail.com'}
                />
              </div>

              {requiresTwoFactor ? (
                <div className="form-group">
                  <input
                    autoComplete="one-time-code"
                    className="simple-input"
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Código de 2FA"
                    value={twoFactorCode}
                  />
                </div>
              ) : null}

              {error ? <p className="form-error">{error}</p> : null}

              <button className="login-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Entrando...' : requiresTwoFactor ? 'Confirmar código' : 'Acessar'}
                {!isSubmitting && <ArrowRight size={18} strokeWidth={2} />}
              </button>
            </form>

            <p className="signup-link">
              Não tem uma conta? <Link to="/signup">Criar conta</Link>
            </p>
            <p className="signup-link">
              Esqueceu a senha? <Link to="/forgot-password">Recuperar acesso</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}

function sanitizeInternalRedirect(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('://')) {
    return null
  }

  return value
}
