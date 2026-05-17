import type { FormEvent } from 'react'
import { useState } from 'react'
import { KeyRound, MailCheck, ShieldCheck, UserRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { PasswordField } from '@/components/PasswordField'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'

export function ProfilePage() {
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const setUser = useSessionStore((state) => state.setUser)
  const addToast = useToastStore((state) => state.addToast)
  const [name, setName] = useState(user?.name ?? '')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [pendingPurpose, setPendingPurpose] = useState('')
  const [token, setToken] = useState('')

  async function handleLogout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  async function handleProfileRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      const response = await systemService.requestProfileChange({ name })

      setPendingPurpose(response.purpose)
      setToken('')
      addToast({
        tone: 'success',
        title: 'Código enviado',
        description: 'Confira seu e-mail para confirmar a alteração.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível enviar',
        description: getApiErrorMessage(error, 'Tente novamente em instantes.'),
      })
    }
  }

  async function handlePasswordRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (pendingPurpose === 'password_change') {
      await handleConfirm(event)
      return
    }

    try {
      const response = await systemService.requestProfileChange({
        password,
        password_confirmation: passwordConfirmation,
      })

      setPendingPurpose(response.purpose)
      setToken('')
      addToast({
        tone: 'success',
        title: 'Código enviado',
        description: 'Confira seu e-mail para confirmar a troca de senha.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível enviar',
        description: getApiErrorMessage(error, 'Revise a senha e tente novamente.'),
      })
    }
  }

  async function handleConfirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!pendingPurpose || !token) {
      return
    }

    try {
      const updatedUser = await systemService.confirmProfileChange({ purpose: pendingPurpose, token })

      setUser(updatedUser)
      setToken('')
      setPendingPurpose('')
      if (pendingPurpose === 'password_change') {
        setPassword('')
        setPasswordConfirmation('')
      }
      addToast({
        tone: 'success',
        title: 'Alteração confirmada',
        description: 'Sua conta foi atualizada com segurança.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Código inválido',
        description: getApiErrorMessage(error, 'Confira o código e tente novamente.'),
      })
    }
  }

  async function handleEmailVerification() {
    try {
      await systemService.requestEmailVerification()
      setPendingPurpose('email_verification')
      setToken('')
      addToast({
        tone: 'success',
        title: 'Código enviado',
        description: 'Confira seu e-mail para confirmar a conta.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível enviar',
        description: getApiErrorMessage(error, 'Tente novamente em instantes.'),
      })
    }
  }

  async function handleTwoFactor() {
    try {
      await systemService.requestTwoFactor()
      setPendingPurpose('two_factor_setup')
      setToken('')
      addToast({
        tone: 'success',
        title: 'Código enviado',
        description: 'Confira seu e-mail para ativar o 2FA.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível enviar',
        description: getApiErrorMessage(error, 'Tente novamente em instantes.'),
      })
    }
  }

  async function handleConfirmSecurity() {
    if (!token) {
      return
    }

    try {
      const updatedUser =
        pendingPurpose === 'two_factor_setup'
          ? await systemService.confirmTwoFactor(token)
          : await systemService.confirmEmailVerification(token)

      setUser(updatedUser)
      setToken('')
      setPendingPurpose('')
      addToast({
        tone: 'success',
        title: 'Confirmação concluída',
        description:
          pendingPurpose === 'two_factor_setup'
            ? 'Autenticação em duas etapas ativada.'
            : 'E-mail verificado com sucesso.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Código inválido',
        description: getApiErrorMessage(error, 'Confira o código e tente novamente.'),
      })
    }
  }

  return (
    <AppShell onLogout={handleLogout} userName={user?.name ?? 'Usuário'}>
      <div className="profile-page">
        <section className="system-hero panel">
          <div>
            <span className="panel__eyebrow">Perfil seguro</span>
            <h1>Conta, senha e verificação</h1>
          </div>
        </section>

        <section className="system-grid-two">
          <form className="management-panel panel" onSubmit={handleProfileRequest}>
            <UserRound size={22} />
            <h2>Alterar nome</h2>
            <input value={name} onChange={(event) => setName(event.target.value)} />
            <button className="primary-button" type="submit">
              Enviar código
            </button>
          </form>

          <form className="management-panel panel" onSubmit={handlePasswordRequest}>
            <KeyRound size={22} />
            <h2>Trocar senha</h2>
            <PasswordField
              placeholder="Nova senha"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <PasswordField
              placeholder="Confirmar nova senha"
              value={passwordConfirmation}
              onChange={(event) => setPasswordConfirmation(event.target.value)}
            />
            {pendingPurpose === 'password_change' ? (
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Código recebido por e-mail"
                value={token}
              />
            ) : null}
            <button className="primary-button" type="submit">
              {pendingPurpose === 'password_change' ? 'Confirmar alteração' : 'Solicitar troca segura'}
            </button>
          </form>
        </section>

        <section className="system-grid-two">
          <article className="management-panel panel">
            <MailCheck size={22} />
            <h2>Verificação por e-mail</h2>
            <p>{user?.email_verified_at ? 'E-mail verificado.' : 'E-mail ainda não verificado.'}</p>
            <button className="ghost-button" onClick={() => void handleEmailVerification()} type="button">
              Enviar código de verificação
            </button>
          </article>

          <article className="management-panel panel">
            <ShieldCheck size={22} />
            <h2>Autenticação em duas etapas</h2>
            <p>{user?.two_factor_enabled ? '2FA ativa.' : '2FA ainda não ativada.'}</p>
            <button className="ghost-button" onClick={() => void handleTwoFactor()} type="button">
              Ativar 2FA por e-mail
            </button>
          </article>
        </section>

        {pendingPurpose && pendingPurpose !== 'password_change' ? (
          <form
            className="management-panel panel security-confirm"
            onSubmit={(event) => {
              event.preventDefault()

              if (pendingPurpose === 'email_verification' || pendingPurpose === 'two_factor_setup') {
                void handleConfirmSecurity()
                return
              }

              void handleConfirm(event)
            }}
          >
            <span className="panel__eyebrow">Confirmação pendente</span>
            <h2>Digite o código enviado por e-mail</h2>
            <div className="inline-form">
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={token}
                onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              {pendingPurpose === 'email_verification' || pendingPurpose === 'two_factor_setup' ? (
                <button className="primary-button" type="submit">
                  Confirmar segurança
                </button>
              ) : (
                <button className="primary-button" type="submit">
                  Confirmar alteração
                </button>
              )}
            </div>
          </form>
        ) : null}
      </div>
    </AppShell>
  )
}
