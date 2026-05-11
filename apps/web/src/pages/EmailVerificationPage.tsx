import type { FormEvent } from 'react'
import { useState } from 'react'
import { ArrowRight, LogOut, MailCheck, RotateCcw, ShieldCheck } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'

import { BrandIcon } from '@/components/BrandIcon'
import { BrandMark } from '@/components/BrandMark'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'

export function EmailVerificationPage() {
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const setUser = useSessionStore((state) => state.setUser)
  const addToast = useToastStore((state) => state.addToast)
  const [token, setToken] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (user?.email_verified_at) {
    return <Navigate replace to="/dashboard" />
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedToken = token.replace(/\D/g, '').slice(0, 6)

    if (normalizedToken.length !== 6) {
      const message = 'Digite o código de 6 números enviado para seu e-mail.'

      setError(message)
      addToast({
        tone: 'error',
        title: 'Código incompleto',
        description: message,
      })
      return
    }

    setIsConfirming(true)
    setError(null)

    try {
      const updatedUser = await systemService.confirmEmailVerification(normalizedToken)

      setUser(updatedUser)
      addToast({
        tone: 'success',
        title: 'E-mail confirmado',
        description: 'Conta liberada. Agora você já pode acessar o painel.',
      })
      navigate('/dashboard', { replace: true })
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Código inválido ou expirado. Confira o e-mail e tente novamente.')

      setError(message)
      addToast({
        tone: 'error',
        title: 'Não foi possível confirmar',
        description: message,
      })
    } finally {
      setIsConfirming(false)
    }
  }

  async function handleResend() {
    setIsResending(true)
    setError(null)

    try {
      await systemService.requestEmailVerification()
      addToast({
        tone: 'success',
        title: 'Código reenviado',
        description: 'Enviamos um novo código para seu e-mail.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível reenviar',
        description: getApiErrorMessage(error, 'Tente novamente em instantes.'),
      })
    } finally {
      setIsResending(false)
    }
  }

  async function handleLogout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="login-page email-verification-page">
      <div className="login-background" aria-hidden="true">
        <div className="visual-orb visual-orb--one" />
        <div className="visual-orb visual-orb--two" />
        <div className="visual-orb visual-orb--three" />
        <div className="visual-grid" />
      </div>

      <div className="login-container email-verification-container">
        <header className="login-header">
          <div className="login-header__brand">
            <BrandMark />
          </div>
          <button className="ghost-button" onClick={handleLogout} type="button">
            <LogOut size={17} />
            Sair
          </button>
        </header>

        <main className="email-verification-main">
          <section className="email-verification-card panel">
            <div className="email-verification-card__icon">
              <BrandIcon className="login-logo__image" size={72} />
            </div>

            <span className="panel__eyebrow">Confirmação necessária</span>
            <h1>Verifique seu e-mail para entrar.</h1>
            <p>
              Enviamos um código de 6 números para <strong>{user?.email}</strong>. Digite abaixo para liberar
              sua conta e acessar a página principal.
            </p>

            <form className="email-verification-form" onSubmit={handleConfirm}>
              <label>
                Código de verificação
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  value={token}
                />
              </label>

              {error ? <p className="form-error">{error}</p> : null}

              <button className="login-submit" disabled={isConfirming} type="submit">
                {isConfirming ? 'Confirmando...' : 'Confirmar e acessar'}
                {!isConfirming ? <ArrowRight size={18} /> : null}
              </button>
            </form>

            <div className="email-verification-actions">
              <button className="ghost-button" disabled={isResending} onClick={() => void handleResend()} type="button">
                <RotateCcw size={16} />
                {isResending ? 'Reenviando...' : 'Reenviar código'}
              </button>
            </div>
          </section>

          <aside className="email-verification-side panel">
            <MailCheck size={24} />
            <h2>Confirme para liberar seu acesso</h2>
            <p>
              A gente envia um código para garantir que esse e-mail é seu. Depois da confirmação, seu painel,
              seus pedidos ficam liberados com mais segurança.
            </p>

            <div className="email-verification-proof">
              <span>
                <ShieldCheck size={15} />
                Conta protegida
              </span>
              <span>
                <MailCheck size={15} />
                Reenvio disponível
              </span>
            </div>
          </aside>
        </main>
      </div>
    </div>
  )
}
