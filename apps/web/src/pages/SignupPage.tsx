import type { FormEvent } from 'react'
import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { BrandIcon } from '@/components/BrandIcon'
import { BrandMark } from '@/components/BrandMark'
import { PasswordField } from '@/components/PasswordField'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { useToastStore } from '@/store/useToastStore'

export function SignupPage() {
  const navigate = useNavigate()
  const addToast = useToastStore((state) => state.addToast)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function showSignupError(title: string, message: string) {
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
    const normalizedName = name.trim()

    if (!normalizedName) {
      showSignupError('Nome obrigatório', 'Informe seu nome para criar a conta.')
      setIsSubmitting(false)
      return
    }

    if (!normalizedEmail) {
      showSignupError('E-mail obrigatório', 'Informe seu e-mail.')
      setIsSubmitting(false)
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      showSignupError('E-mail inválido', 'Digite um e-mail válido.')
      setIsSubmitting(false)
      return
    }

    if (!password) {
      showSignupError('Senha obrigatoria', 'Crie uma senha.')
      setIsSubmitting(false)
      return
    }

    if (password.length < 8) {
      showSignupError('Senha curta', 'A senha precisa ter pelo menos 8 caracteres.')
      setIsSubmitting(false)
      return
    }

    if (password !== confirmPassword) {
      const message = 'As senhas não coincidem.'

      showSignupError('Senhas diferentes', message)
      setIsSubmitting(false)
      return
    }

    try {
      await authService.register({
        name: normalizedName,
        email: normalizedEmail,
        password,
        password_confirmation: confirmPassword,
      })

      addToast({
        tone: 'success',
        title: 'Conta criada',
        description: 'Enviamos um código para confirmar seu e-mail antes de liberar o painel.',
      })
      navigate('/verify-email', { replace: true })
    } catch (error: unknown) {
      const message = getApiErrorMessage(
        error,
        'Não foi possível criar a conta. Revise os dados e tente novamente.',
      )

      setError(message)
      addToast({
        tone: 'error',
        title: 'Cadastro não concluído',
        description: message,
      })
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
              <h1>Criar conta de cliente</h1>
              <p>
                Esse cadastro cria uma conta comum de cliente para ver preços, abrir
                pedidos e acompanhar compras. Para virar booster, use a inscrição
                separada na landing page.
              </p>
            </div>

            <div className="auth-benefits" aria-label="Beneficios ao criar conta">
              <span>Pedido como cliente</span>
              <span>Boosters verificados</span>
              <span>Histórico de compras</span>
            </div>

            <form className="login-form" onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <input
                  id="name"
                  autoComplete="name"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Nome"
                  type="text"
                  value={name}
                  className="simple-input"
                  required
                />
              </div>

              <div className="form-group">
                <input
                  id="email"
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="E-mail"
                  type="email"
                  value={email}
                  className="simple-input"
                  required
                />
              </div>

              <div className="form-group">
                <PasswordField
                  id="password"
                  autoComplete="new-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Senha"
                  value={password}
                  className="simple-input"
                  required
                />
              </div>

              <div className="form-group">
                <PasswordField
                  id="confirmPassword"
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirmar Senha"
                  value={confirmPassword}
                  className="simple-input"
                  required
                />
              </div>

              {error ? <p className="form-error">{error}</p> : null}

              <button className="login-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Criando...' : 'Criar Conta'}
                {!isSubmitting && <ArrowRight size={18} strokeWidth={2} />}
              </button>
            </form>

            <p className="signup-link">
              Já tem uma conta? <Link to="/login">Entrar</Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
