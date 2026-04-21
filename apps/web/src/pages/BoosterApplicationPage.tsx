import type { FormEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { MailCheck, Send, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { BrandMark } from '@/components/BrandMark'
import { PasswordField } from '@/components/PasswordField'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { BoosterProfile } from '@/types/auth'
import type { BoosterApplication } from '@/types/system'
import { maskCpf } from '@/utils/masks'

type BoosterApplicationForm = {
  full_name: string
  birth_date: string
  age: string
  cpf: string
  pix_key: string
  gender: string
  in_game_nick: string
  highest_rank: string
  previous_season_rank: string
  available_hours: string
  location: string
  accepts_riot_responsibility: boolean
  accepts_confidentiality_terms: boolean
  opgg_url: string
  discord_username: string
  diamond_plus_eta: string
  accepts_cashflow_decay: boolean
}

type BoosterAccountForm = {
  name: string
  email: string
  password: string
  password_confirmation: string
}

const requiredFields: Array<[keyof BoosterApplicationForm, string]> = [
  ['full_name', 'nome completo'],
  ['birth_date', 'data de nascimento'],
  ['age', 'idade'],
  ['cpf', 'CPF'],
  ['pix_key', 'chave Pix'],
  ['gender', 'gênero'],
  ['in_game_nick', 'nick dentro do jogo'],
  ['highest_rank', 'maior rank alcançado'],
  ['previous_season_rank', 'rank da season passada'],
  ['available_hours', 'horários disponíveis'],
  ['location', 'estado e cidade'],
  ['opgg_url', 'OP.GG'],
  ['discord_username', 'usuário do Discord'],
  ['diamond_plus_eta', 'tempo para upar uma conta Diamante+'],
]

function initialAccountForm(): BoosterAccountForm {
  return {
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
  }
}

function initialApplicationForm(fullName = ''): BoosterApplicationForm {
  return {
    full_name: fullName,
    birth_date: '',
    age: '',
    cpf: '',
    pix_key: '',
    gender: '',
    in_game_nick: '',
    highest_rank: '',
    previous_season_rank: '',
    available_hours: '',
    location: '',
    accepts_riot_responsibility: false,
    accepts_confidentiality_terms: false,
    opgg_url: '',
    discord_username: '',
    diamond_plus_eta: '',
    accepts_cashflow_decay: false,
  }
}

function textOrEmpty(value?: string | number | null) {
  return value === null || value === undefined ? '' : String(value)
}

function formFromApplication(application: BoosterApplication | null, fallbackName: string): BoosterApplicationForm {
  if (!application) {
    return initialApplicationForm(fallbackName)
  }

  return {
    full_name: textOrEmpty(application.full_name) || fallbackName,
    birth_date: textOrEmpty(application.birth_date),
    age: textOrEmpty(application.age),
    cpf: maskCpf(textOrEmpty(application.cpf)),
    pix_key: textOrEmpty(application.pix_key),
    gender: textOrEmpty(application.gender),
    in_game_nick: textOrEmpty(application.in_game_nick),
    highest_rank: textOrEmpty(application.highest_rank),
    previous_season_rank: textOrEmpty(application.previous_season_rank),
    available_hours: textOrEmpty(application.available_hours),
    location: textOrEmpty(application.location),
    accepts_riot_responsibility: Boolean(application.accepts_riot_responsibility),
    accepts_confidentiality_terms: Boolean(application.accepts_confidentiality_terms),
    opgg_url: textOrEmpty(application.opgg_url),
    discord_username: textOrEmpty(application.discord_username),
    diamond_plus_eta: textOrEmpty(application.diamond_plus_eta),
    accepts_cashflow_decay: Boolean(application.accepts_cashflow_decay),
  }
}

export function BoosterApplicationPage() {
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [application, setApplication] = useState<BoosterApplication | null>(null)
  const [accountForm, setAccountForm] = useState<BoosterAccountForm>(() => initialAccountForm())
  const [form, setForm] = useState<BoosterApplicationForm>(() => initialApplicationForm(user?.name ?? ''))
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(user))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isApproved = application?.status === 'approved'

  useEffect(() => {
    let active = true

    async function loadApplication() {
      if (!user) {
        setIsLoading(false)
        return
      }

      try {
        const response = await systemService.getMyBoosterApplication()

        if (!active) {
          return
        }

        setApplication(response)
        setForm(formFromApplication(response, user.name))
      } catch (error: unknown) {
        addToast({
          tone: 'error',
          title: 'Não foi possível carregar',
          description: getApiErrorMessage(error, 'Tente abrir a inscrição novamente em alguns segundos.'),
        })
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadApplication()

    return () => {
      active = false
    }
  }, [addToast, user])

  async function handleLogout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!user && !validateAccountForm()) {
      return
    }

    if (!validateApplicationForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      if (!user) {
        await systemService.submitPublicBoosterApplication({
          ...buildPayload(),
          name: accountForm.name.trim(),
          email: accountForm.email.trim(),
          password: accountForm.password,
          password_confirmation: accountForm.password_confirmation,
        })

        setSubmittedEmail(accountForm.email.trim())
        return
      }

      const response = await systemService.submitBoosterApplication(buildPayload())
      setApplication(response)
      addToast({
        tone: 'success',
        title: 'Inscrição enviada',
        description: 'Sua ficha foi enviada para análise da administração.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Inscrição não enviada',
        description: getApiErrorMessage(error, 'Revise os dados e tente novamente.'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  function updateAccountForm(patch: Partial<BoosterAccountForm>) {
    setAccountForm((currentForm) => ({
      ...currentForm,
      ...patch,
    }))
  }

  function updateForm(patch: Partial<BoosterApplicationForm>) {
    setForm((currentForm) => ({
      ...currentForm,
      ...patch,
    }))
  }

  function validateAccountForm() {
    const email = accountForm.email.trim()

    if (!accountForm.name.trim()) {
      showValidationError('Nome obrigatório', 'Informe seu nome para criar o cadastro de booster.')
      return false
    }

    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      showValidationError('E-mail inválido', 'Informe um e-mail válido para receber as atualizações.')
      return false
    }

    if (accountForm.password.length < 8) {
      showValidationError('Senha curta', 'A senha precisa ter pelo menos 8 caracteres.')
      return false
    }

    if (accountForm.password !== accountForm.password_confirmation) {
      showValidationError('Senhas diferentes', 'A confirmação precisa ser igual à senha.')
      return false
    }

    return true
  }

  function validateApplicationForm() {
    const missingField = requiredFields.find(([field]) => !String(form[field]).trim())

    if (missingField) {
      showValidationError('Inscrição incompleta', `Preencha o campo ${missingField[1]} antes de enviar.`)
      return false
    }

    if (
      !form.accepts_riot_responsibility ||
      !form.accepts_confidentiality_terms ||
      !form.accepts_cashflow_decay
    ) {
      showValidationError('Termos pendentes', 'Marque todos os termos obrigatórios para enviar a inscrição.')
      return false
    }

    return true
  }

  function showValidationError(title: string, description: string) {
    addToast({
      tone: 'error',
      title,
      description,
    })
  }

  function buildPayload(): BoosterProfile {
    return {
      full_name: form.full_name.trim(),
      birth_date: form.birth_date,
      age: Number(form.age),
      cpf: form.cpf.trim(),
      pix_key: form.pix_key.trim(),
      gender: form.gender,
      in_game_nick: form.in_game_nick.trim(),
      highest_rank: form.highest_rank.trim(),
      previous_season_rank: form.previous_season_rank.trim(),
      available_hours: form.available_hours.trim(),
      location: form.location.trim(),
      accepts_riot_responsibility: form.accepts_riot_responsibility,
      accepts_confidentiality_terms: form.accepts_confidentiality_terms,
      opgg_url: form.opgg_url.trim(),
      discord_username: form.discord_username.trim(),
      diamond_plus_eta: form.diamond_plus_eta.trim(),
      accepts_cashflow_decay: form.accepts_cashflow_decay,
    }
  }

  function renderPage(content: ReactNode) {
    if (user) {
      return (
        <AppShell onLogout={handleLogout} userName={user.name}>
          {content}
        </AppShell>
      )
    }

    return (
      <div className="login-page public-application-page">
        <div className="login-background" aria-hidden="true">
          <div className="visual-orb visual-orb--one" />
          <div className="visual-orb visual-orb--two" />
          <div className="visual-orb visual-orb--three" />
          <div className="visual-grid" />
        </div>

        <div className="login-container public-application-container">
          <header className="login-header">
            <BrandMark />
            <Link className="ghost-button" to="/">
              Voltar
            </Link>
          </header>
          <main className="public-application-main">{content}</main>
        </div>
      </div>
    )
  }

  if (submittedEmail) {
    return renderPage(
      <section className="application-success-card panel">
        <MailCheck size={34} />
        <span className="panel__eyebrow">Inscrição enviada</span>
        <h1>Agora é com a Horizon.</h1>
        <p>
          Sua ficha entrou na fila de análise. Você receberá atualizações pelo e-mail
          <strong> {submittedEmail}</strong> assim que a equipe revisar seu cadastro.
        </p>
        <Link className="primary-button" to="/">
          Voltar para a página principal
        </Link>
      </section>,
    )
  }

  const content = (
    <div className="booster-application-page">
      <section className="system-hero panel">
        <div>
          <span className="panel__eyebrow">Inscrição de booster</span>
          <h1>Entre para o time Horizon</h1>
        </div>
      </section>

      {application ? (
        <article className={`application-status-card panel application-status-card--${application.status}`}>
          <ShieldCheck size={22} />
          <div>
            <span className="panel__eyebrow">Status da inscrição</span>
            <h2>
              {application.status === 'pending'
                ? 'Em análise'
                : application.status === 'approved'
                  ? 'Aprovada'
                  : 'Rejeitada'}
            </h2>
            <p>
              {application.status === 'pending'
                ? 'Sua ficha está na fila da administração. Você receberá atualizações pelo e-mail cadastrado.'
                : application.status === 'approved'
                  ? 'Sua conta já foi aprovada como Booster.'
                  : application.review_notes || 'A inscrição foi rejeitada. Revise os dados e envie novamente se fizer sentido.'}
            </p>
          </div>
        </article>
      ) : null}

      <form className="management-panel panel" onSubmit={handleSubmit}>
        <div className="booster-profile-form__header">
          <div>
            <span className="panel__eyebrow">Ficha completa</span>
            <h3>Dados pessoais, conta e disponibilidade</h3>
          </div>
          <p>Esses dados ficam disponíveis apenas para a equipe de administração.</p>
        </div>

        {!user ? (
          <div className="form-grid booster-fields-grid">
            <FieldWithHelper helper="Nome usado para identificar sua conta no painel depois da aprovação." label="Nome de acesso">
              <input
                onChange={(event) => updateAccountForm({ name: event.target.value })}
                placeholder="Ex: João Horizon"
                required
                value={accountForm.name}
              />
            </FieldWithHelper>
            <FieldWithHelper helper="É por aqui que você recebe a resposta da análise e acessa sua conta." label="E-mail">
              <input
                onChange={(event) => updateAccountForm({ email: event.target.value })}
                placeholder="seuemail@exemplo.com"
                required
                type="email"
                value={accountForm.email}
              />
            </FieldWithHelper>
            <FieldWithHelper helper="Use pelo menos 8 caracteres. Ela será usada caso sua ficha seja aprovada." label="Senha">
              <PasswordField
                onChange={(event) => updateAccountForm({ password: event.target.value })}
                placeholder="Senha de acesso"
                required
                value={accountForm.password}
              />
            </FieldWithHelper>
            <FieldWithHelper helper="Repita exatamente a senha acima para evitar erro de digitação." label="Confirmar senha">
              <PasswordField
                onChange={(event) => updateAccountForm({ password_confirmation: event.target.value })}
                placeholder="Confirmar senha"
                required
                value={accountForm.password_confirmation}
              />
            </FieldWithHelper>
          </div>
        ) : null}

        <div className="form-grid booster-fields-grid">
          <FieldWithHelper helper="Use seu nome real completo para conferência interna da equipe." label="Nome completo">
            <input
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ full_name: event.target.value })}
              placeholder="Nome completo"
              required
              value={form.full_name}
            />
          </FieldWithHelper>
          <FieldWithHelper helper="Ajuda a validar idade mínima e manter o cadastro organizado." label="Data de nascimento">
            <input
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ birth_date: event.target.value })}
              required
              type="date"
              value={form.birth_date}
            />
          </FieldWithHelper>
          <FieldWithHelper helper="Informe sua idade atual em números." label="Idade">
            <input
              disabled={isLoading || isApproved}
              min={13}
              onChange={(event) => updateForm({ age: event.target.value })}
              placeholder="Ex: 22"
              required
              type="number"
              value={form.age}
            />
          </FieldWithHelper>
          <FieldWithHelper helper="Documento usado apenas para análise interna e segurança financeira." label="CPF">
            <input
              disabled={isLoading || isApproved}
              inputMode="numeric"
              maxLength={14}
              onChange={(event) => updateForm({ cpf: maskCpf(event.target.value) })}
              placeholder="000.000.000-00"
              required
              value={form.cpf}
            />
          </FieldWithHelper>
          <FieldWithHelper helper="Chave usada para pagamentos caso você seja aprovado como booster." label="Chave Pix">
            <input
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ pix_key: event.target.value })}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              required
              value={form.pix_key}
            />
          </FieldWithHelper>
          <FieldWithHelper helper="Campo de perfil interno. Se preferir, selecione 'Prefiro não informar'." label="Gênero">
            <select
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ gender: event.target.value })}
              required
              value={form.gender}
            >
              <option value="">Selecione</option>
              <option value="female">Feminino</option>
              <option value="male">Masculino</option>
              <option value="non_binary">Não-binário</option>
              <option value="prefer_not_to_say">Prefiro não informar</option>
              <option value="other">Outro</option>
            </select>
          </FieldWithHelper>
          <FieldWithHelper helper="Nick principal usado para conferir perfil, histórico e comunicação." label="Nick no jogo">
            <input
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ in_game_nick: event.target.value })}
              placeholder="Ex: HorizonCarry"
              required
              value={form.in_game_nick}
            />
          </FieldWithHelper>
          <FieldWithHelper helper="Maior elo que você já alcançou em League of Legends." label="Maior rank alcançado">
            <input
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ highest_rank: event.target.value })}
              placeholder="Ex: Challenger, Mestre, Diamante 1"
              required
              value={form.highest_rank}
            />
          </FieldWithHelper>
          <FieldWithHelper helper="Rank final ou aproximado da última season jogada." label="Rank da season passada">
            <input
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ previous_season_rank: event.target.value })}
              placeholder="Ex: Mestre 200 LP"
              required
              value={form.previous_season_rank}
            />
          </FieldWithHelper>
          <FieldWithHelper helper="Cidade e estado ajudam a organizar horários e pagamentos." label="Localização">
            <input
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ location: event.target.value })}
              placeholder="Ex: São Paulo, SP"
              required
              value={form.location}
            />
          </FieldWithHelper>
          <FieldWithHelper helper="Envie o link do seu perfil para análise de campeões, rank e histórico." label="OP.GG">
            <input
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ opgg_url: event.target.value })}
              placeholder="https://op.gg/summoners/..."
              required
              value={form.opgg_url}
            />
          </FieldWithHelper>
          <FieldWithHelper helper="Usuário que a equipe usará para contato rápido durante a análise." label="Discord">
            <input
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ discord_username: event.target.value })}
              placeholder="Ex: seuuser ou seuuser#0000"
              required
              value={form.discord_username}
            />
          </FieldWithHelper>
          <FieldWithHelper helper="Estimativa honesta para avaliar ritmo de entrega em contas altas." label="Prazo para Diamante+">
            <input
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ diamond_plus_eta: event.target.value })}
              placeholder="Ex: 3 a 5 dias"
              required
              value={form.diamond_plus_eta}
            />
          </FieldWithHelper>
          <FieldWithHelper
            helper="Informe dias, horários, fuso se necessário e se pode jogar fim de semana."
            label="Horários disponíveis"
            span
          >
            <textarea
              disabled={isLoading || isApproved}
              onChange={(event) => updateForm({ available_hours: event.target.value })}
              placeholder="Ex: Segunda a sexta das 19h às 23h; sábado à tarde."
              required
              rows={3}
              value={form.available_hours}
            />
          </FieldWithHelper>
        </div>

        <div className="agreement-grid">
          <AgreementCard
            checked={form.accepts_riot_responsibility}
            disabled={isLoading || isApproved}
            onChange={(checked) => updateForm({ accepts_riot_responsibility: checked })}
            title="Responsabilidade Riot Games"
          >
            Concordo que punições ou investigações da Riot Games na minha conta não acarretam responsabilidade à Horizon Boost.
          </AgreementCard>

          <AgreementCard
            checked={form.accepts_confidentiality_terms}
            disabled={isLoading || isApproved}
            onChange={(checked) => updateForm({ accepts_confidentiality_terms: checked })}
            title="Sigilo e regras internas"
          >
            Confirmo que dados da Horizon Boost são sigilosos e que infringir regras pode gerar banimento e exclusão da conta de booster.
          </AgreementCard>

          <AgreementCard
            checked={form.accepts_cashflow_decay}
            disabled={isLoading || isApproved}
            onChange={(checked) => updateForm({ accepts_cashflow_decay: checked })}
            title="Cashflow e decay"
          >
            Estou ciente de que serviços de cashflow podem exigir manutenção de elo por decay da conta entregue.
          </AgreementCard>
        </div>

        <button
          className="primary-button primary-button--crimson"
          disabled={isLoading || isSubmitting || isApproved}
          type="submit"
        >
          <Send size={18} />
          {isSubmitting ? 'Enviando...' : application?.status === 'pending' ? 'Atualizar inscrição' : 'Enviar inscrição'}
        </button>
      </form>
    </div>
  )

  return renderPage(content)
}

function FieldWithHelper({
  children,
  helper,
  label,
  span = false,
}: {
  children: ReactNode
  helper: string
  label: string
  span?: boolean
}) {
  return (
    <label className={`field-with-helper${span ? ' field-span-2' : ''}`}>
      <span>{label}</span>
      {children}
      <small>{helper}</small>
    </label>
  )
}

function AgreementCard({
  checked,
  children,
  disabled,
  onChange,
  title,
}: {
  checked: boolean
  children: ReactNode
  disabled: boolean
  onChange: (checked: boolean) => void
  title: string
}) {
  return (
    <label className="agreement-card">
      <input
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span>
        <strong>{title}</strong>
        <small>{children}</small>
      </span>
    </label>
  )
}
