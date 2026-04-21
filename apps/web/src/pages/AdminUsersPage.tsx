import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Edit3, Trash2, UserPlus, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PasswordField } from '@/components/PasswordField'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { AuthUser, BoosterProfile, UserRole } from '@/types/auth'
import type { BoosterApplication, UsersResponse } from '@/types/system'
import { maskCpf } from '@/utils/masks'

type BoosterProfileForm = {
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
  initial_percentage: string
  accepts_initial_percentage: boolean
  opgg_url: string
  discord_username: string
  diamond_plus_eta: string
  accepts_cashflow_decay: boolean
}

type AdminUserForm = {
  name: string
  email: string
  password: string
  role: UserRole
  staff_profile: string
  booster_profile: BoosterProfileForm
}

const fallbackRoles: Array<{ value: UserRole; label: string }> = [
  { value: 'booster', label: 'Booster' },
  { value: 'staff', label: 'Staff' },
  { value: 'master_admin', label: 'Master Admin' },
]

const editableFallbackRoles: Array<{ value: UserRole; label: string }> = [
  { value: 'customer', label: 'Cliente' },
  ...fallbackRoles,
]

const fallbackStaffProfiles = [
  { value: 'operations', label: 'Staff normal' },
  { value: 'finance', label: 'Staff financeiro' },
]

const staffProfileDescriptions: Record<string, string> = {
  none: 'Staff sem nicho específico. Bom para acesso básico ou para configurar permissões depois.',
  operations: 'Focado na operação: boosters, pedidos em andamento, progresso e rotina do boost.',
  finance: 'Inclui operação e visão financeira: pagamentos, retiradas, metas e pendências.',
}

const roleDescriptions: Record<UserRole, string> = {
  customer: 'Compra boosts, acompanha pedidos e histórico.',
  booster: 'Recebe pedidos, vê ganhos, metas e saques.',
  staff: 'Ajuda na operação e pode ganhar permissões por nicho.',
  master_admin: 'Acesso total ao painel e às áreas críticas.',
}

const boosterRequiredFields: Array<[keyof BoosterProfileForm, string]> = [
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

function createInitialBoosterProfile(fullName = ''): BoosterProfileForm {
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
    initial_percentage: '65',
    accepts_initial_percentage: false,
    opgg_url: '',
    discord_username: '',
    diamond_plus_eta: '',
    accepts_cashflow_decay: false,
  }
}

function createInitialForm(): AdminUserForm {
  return {
    name: '',
    email: '',
    password: '',
    role: 'staff',
    staff_profile: '',
    booster_profile: createInitialBoosterProfile(),
  }
}

function textOrEmpty(value?: string | number | null) {
  return value === null || value === undefined ? '' : String(value)
}

function toBoosterProfileForm(profile?: BoosterProfile | null, fallbackName = ''): BoosterProfileForm {
  return {
    full_name: textOrEmpty(profile?.full_name) || fallbackName,
    birth_date: textOrEmpty(profile?.birth_date),
    age: textOrEmpty(profile?.age),
    cpf: maskCpf(textOrEmpty(profile?.cpf)),
    pix_key: textOrEmpty(profile?.pix_key),
    gender: textOrEmpty(profile?.gender),
    in_game_nick: textOrEmpty(profile?.in_game_nick),
    highest_rank: textOrEmpty(profile?.highest_rank),
    previous_season_rank: textOrEmpty(profile?.previous_season_rank),
    available_hours: textOrEmpty(profile?.available_hours),
    location: textOrEmpty(profile?.location),
    accepts_riot_responsibility: Boolean(profile?.accepts_riot_responsibility),
    accepts_confidentiality_terms: Boolean(profile?.accepts_confidentiality_terms),
    initial_percentage: textOrEmpty(profile?.initial_percentage) || '65',
    accepts_initial_percentage: Boolean(profile?.accepts_initial_percentage),
    opgg_url: textOrEmpty(profile?.opgg_url),
    discord_username: textOrEmpty(profile?.discord_username),
    diamond_plus_eta: textOrEmpty(profile?.diamond_plus_eta),
    accepts_cashflow_decay: Boolean(profile?.accepts_cashflow_decay),
  }
}

function normalizeText(value: string) {
  return value.trim() || null
}

export function AdminUsersPage() {
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [payload, setPayload] = useState<UsersResponse | null>(null)
  const [pendingApplications, setPendingApplications] = useState<BoosterApplication[]>([])
  const [form, setForm] = useState<AdminUserForm>(() => createInitialForm())
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [reviewingApplicationId, setReviewingApplicationId] = useState<number | null>(null)

  async function loadAdminData() {
    const [usersResponse, applicationsResponse] = await Promise.all([
      systemService.getUsers(),
      systemService.getBoosterApplications('pending'),
    ])

    setPayload(usersResponse)
    setPendingApplications(applicationsResponse)
  }

  useEffect(() => {
    let active = true

    async function bootstrapUsers() {
      const [usersResponse, applicationsResponse] = await Promise.all([
        systemService.getUsers(),
        systemService.getBoosterApplications('pending'),
      ])

      if (!active) {
        return
      }

      setPayload(usersResponse)
      setPendingApplications(applicationsResponse)
    }

    void bootstrapUsers()

    return () => {
      active = false
    }
  }, [])

  async function handleLogout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = form.name.trim()
    const email = form.email.trim()
    const password = form.password.trim()

    if (!name || !email) {
      addToast({
        tone: 'error',
        title: 'Dados incompletos',
        description: 'Informe nome e email antes de salvar o cadastro.',
      })
      return
    }

    if (!editingUser && !password) {
      addToast({
        tone: 'error',
        title: 'Senha obrigatória',
        description: 'Crie uma senha inicial para o novo usuário.',
      })
      return
    }

    if (!editingUser && form.role === 'customer') {
      addToast({
        tone: 'error',
        title: 'Cliente não é criado por aqui',
        description: 'Clientes devem se cadastrar pelo fluxo normal do site.',
      })
      return
    }

    if (password && password.length < 8) {
      addToast({
        tone: 'error',
        title: 'Senha curta',
        description: 'A senha precisa ter pelo menos 8 caracteres.',
      })
      return
    }

    if (!validateBoosterProfile()) {
      return
    }

    setIsSaving(true)

    try {
      const normalizedStaffProfile = form.role === 'staff' ? form.staff_profile || null : null
      const basePayload = {
        name,
        email,
        role: form.role,
        staff_profile: normalizedStaffProfile,
        booster_profile: form.role === 'booster' ? buildBoosterProfilePayload() : null,
      }

      if (editingUser) {
        await systemService.updateUser(editingUser.id, {
          ...basePayload,
          ...(password ? { password } : {}),
        })
      } else {
        await systemService.createUser({
          ...basePayload,
          password,
        })
      }

      addToast({
        tone: 'success',
        title: editingUser ? 'Usuário atualizado' : 'Usuário cadastrado',
        description: editingUser
          ? 'As informações do cadastro foram salvas.'
          : 'O novo usuário já pode acessar a plataforma.',
      })

      resetForm()
      await loadAdminData()
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: editingUser ? 'Não foi possível editar' : 'Não foi possível cadastrar',
        description: getApiErrorMessage(error, 'Revise os dados do usuário e tente novamente.'),
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleToggleActive(target: AuthUser) {
    try {
      await systemService.setUserActive(target.id, !target.is_active)
      addToast({
        tone: 'success',
        title: target.is_active ? 'Usuário desativado' : 'Usuário ativado',
        description: `${target.name} foi ${target.is_active ? 'desativado' : 'ativado'} com sucesso.`,
      })
      await loadAdminData()
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Status não alterado',
        description: getApiErrorMessage(error, 'Não foi possível alterar o status do usuário.'),
      })
    }
  }

  function handleDelete(target: AuthUser) {
    setDeleteTarget(target)
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return
    }

    setIsDeleting(true)

    try {
      await systemService.deleteUser(deleteTarget.id)

      if (editingUser?.id === deleteTarget.id) {
        resetForm()
      }

      addToast({
        tone: 'success',
        title: 'Usuário excluído',
        description: `${deleteTarget.name} foi removido da plataforma.`,
      })

      setDeleteTarget(null)
      await loadAdminData()
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Usuário não excluído',
        description: getApiErrorMessage(error, 'Não foi possível excluir este usuário.'),
      })
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleReviewApplication(application: BoosterApplication, action: 'approve' | 'reject') {
    setReviewingApplicationId(application.id)

    try {
      await systemService.reviewBoosterApplication(application.id, action)
      addToast({
        tone: 'success',
        title: action === 'approve' ? 'Booster aprovado' : 'Inscrição rejeitada',
        description:
          action === 'approve'
            ? `${application.full_name} agora tem acesso como Booster.`
            : `A inscrição de ${application.full_name} saiu da fila pendente.`,
      })
      await loadAdminData()
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Revisão não concluída',
        description: getApiErrorMessage(error, 'Não foi possível revisar essa inscrição agora.'),
      })
    } finally {
      setReviewingApplicationId(null)
    }
  }

  function handleEdit(target: AuthUser) {
    setEditingUser(target)
    setForm({
      name: target.name,
      email: target.email,
      password: '',
      role: target.role,
      staff_profile: target.staff_profile ?? '',
      booster_profile: toBoosterProfileForm(target.booster_profile, target.name),
    })
  }

  function resetForm() {
    setEditingUser(null)
    setForm(createInitialForm())
  }

  function handleRoleChange(role: UserRole) {
    setForm((currentForm) => ({
      ...currentForm,
      role,
      staff_profile: role === 'staff' ? currentForm.staff_profile : '',
      booster_profile:
        role === 'booster' && !currentForm.booster_profile.full_name
          ? { ...currentForm.booster_profile, full_name: currentForm.name }
          : currentForm.booster_profile,
    }))
  }

  function updateBoosterProfile(patch: Partial<BoosterProfileForm>) {
    setForm((currentForm) => ({
      ...currentForm,
      booster_profile: {
        ...currentForm.booster_profile,
        ...patch,
      },
    }))
  }

  function validateBoosterProfile() {
    if (form.role !== 'booster') {
      return true
    }

    const missingField = boosterRequiredFields.find(([field]) => !String(form.booster_profile[field]).trim())

    if (missingField) {
      addToast({
        tone: 'error',
        title: 'Ficha do booster incompleta',
        description: `Preencha o campo ${missingField[1]} antes de salvar.`,
      })
      return false
    }

    return true
  }

  function buildBoosterProfilePayload(): BoosterProfile {
    const profile = form.booster_profile

    return {
      full_name: profile.full_name.trim(),
      birth_date: profile.birth_date || null,
      age: profile.age ? Number(profile.age) : null,
      cpf: profile.cpf.trim(),
      pix_key: profile.pix_key.trim(),
      gender: normalizeText(profile.gender),
      in_game_nick: profile.in_game_nick.trim(),
      highest_rank: profile.highest_rank.trim(),
      previous_season_rank: profile.previous_season_rank.trim(),
      available_hours: profile.available_hours.trim(),
      location: profile.location.trim(),
      accepts_riot_responsibility: profile.accepts_riot_responsibility,
      accepts_confidentiality_terms: profile.accepts_confidentiality_terms,
      initial_percentage: profile.initial_percentage ? Number(profile.initial_percentage) : 65,
      accepts_initial_percentage: profile.accepts_initial_percentage,
      opgg_url: profile.opgg_url.trim(),
      discord_username: profile.discord_username.trim(),
      diamond_plus_eta: profile.diamond_plus_eta.trim(),
      accepts_cashflow_decay: profile.accepts_cashflow_decay,
    }
  }

  const allRoleOptions = payload?.roles.length ? payload.roles : editableFallbackRoles
  const roleOptions = editingUser ? allRoleOptions : allRoleOptions.filter((role) => role.value !== 'customer')
  const staffProfileOptions = payload?.staff_profiles.length ? payload.staff_profiles : fallbackStaffProfiles
  const boosterProfile = form.booster_profile

  return (
    <AppShell onLogout={handleLogout} userName={user?.name ?? 'Admin'}>
      <div className="admin-users-page">
        <section className="system-hero panel">
          <div>
            <span className="panel__eyebrow">Módulo de usuários</span>
            <h1>Cadastros da plataforma</h1>
          </div>
        </section>

        <section className="management-panel panel">
          <div className="form-panel-title">
            <div>
              <span className="panel__eyebrow">Solicitações pendentes</span>
              <h2>Inscrições de boosters</h2>
            </div>
            <strong className="pending-counter">{pendingApplications.length}</strong>
          </div>

          {pendingApplications.length > 0 ? (
            <div className="application-review-grid">
              {pendingApplications.map((application) => (
                <article className="application-review-card" key={application.id}>
                  <div>
                    <span className="panel__eyebrow">{application.user?.email ?? 'Usuário cadastrado'}</span>
                    <h3>{application.full_name}</h3>
                    <p>
                      Nick: {application.in_game_nick} • Maior rank: {application.highest_rank} • Discord:{' '}
                      {application.discord_username}
                    </p>
                  </div>

                  <div className="application-review-card__meta">
                    <span>Pix: {application.pix_key}</span>
                    <span>OP.GG: {application.opgg_url}</span>
                    <span>Disponibilidade: {application.available_hours}</span>
                    <span>Diamante+: {application.diamond_plus_eta}</span>
                  </div>

                  <div className="row-actions">
                    <button
                      className="ghost-button"
                      disabled={reviewingApplicationId === application.id}
                      onClick={() => void handleReviewApplication(application, 'reject')}
                      type="button"
                    >
                      Rejeitar
                    </button>
                    <button
                      className="primary-button"
                      disabled={reviewingApplicationId === application.id}
                      onClick={() => void handleReviewApplication(application, 'approve')}
                      type="button"
                    >
                      Aprovar booster
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p>Nenhuma inscrição de booster pendente no momento.</p>
          )}
        </section>

        <form className="management-panel panel" onSubmit={handleSubmit}>
          <div className="form-panel-title">
            <div className="form-panel-title__icon">
              <UserPlus size={22} />
            </div>
            <div>
              <span className="panel__eyebrow">{editingUser ? 'Editando usuário' : 'Novo cadastro'}</span>
              <h2>{editingUser ? editingUser.name : 'Cadastrar usuário'}</h2>
            </div>
            {editingUser ? (
              <button className="ghost-button" onClick={resetForm} type="button">
                <X size={16} />
                Cancelar edição
              </button>
            ) : null}
          </div>

          <div className="form-grid">
            <input
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Nome de acesso"
              required
              value={form.name}
            />
            <input
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="Email"
              required
              type="email"
              value={form.email}
            />
            <PasswordField
              minLength={8}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder={editingUser ? 'Nova senha (opcional)' : 'Senha inicial'}
              required={!editingUser}
              value={form.password}
            />
          </div>

          <div className="role-editor">
            <div className="role-editor__header">
              <div>
                <span className="panel__eyebrow">Tipo de usuário</span>
                <h3>Defina o que essa conta é</h3>
              </div>
              <p>Ao editar alguém, basta trocar o card abaixo e salvar. O backend recalcula as permissões automaticamente.</p>
            </div>

            <div className="role-picker" role="radiogroup" aria-label="Tipo de usuário">
              {roleOptions.map((role) => (
                <button
                  aria-checked={form.role === role.value}
                  className={`role-option${form.role === role.value ? ' is-selected' : ''}`}
                  key={role.value}
                  onClick={() => handleRoleChange(role.value)}
                  role="radio"
                  type="button"
                >
                  <strong>{role.label}</strong>
                  <span>{roleDescriptions[role.value]}</span>
                </button>
              ))}
            </div>

            {form.role === 'staff' ? (
              <div className="staff-profile-picker">
                <span>Subperfil do staff</span>
                <div>
                  <button
                    className={`staff-profile-option${!form.staff_profile ? ' is-selected' : ''}`}
                    onClick={() => setForm({ ...form, staff_profile: '' })}
                    type="button"
                  >
                    <strong>Sem subperfil</strong>
                    <small>{staffProfileDescriptions.none}</small>
                  </button>
                  {staffProfileOptions.map((profile) => (
                    <button
                      className={`staff-profile-option${form.staff_profile === profile.value ? ' is-selected' : ''}`}
                      key={profile.value}
                      onClick={() => setForm({ ...form, staff_profile: profile.value })}
                      type="button"
                    >
                      <strong>{profile.label}</strong>
                      <small>{staffProfileDescriptions[profile.value] ?? 'Subperfil customizado para permissões futuras.'}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {form.role === 'booster' ? (
            <section className="booster-profile-form">
              <div className="booster-profile-form__header">
                <div>
                  <span className="panel__eyebrow">Ficha do booster</span>
                  <h3>Dados operacionais e financeiros</h3>
                </div>
                <p>
                  Essas informações ajudam a aprovar o booster, organizar pagamentos e
                  controlar disponibilidade para serviços futuros.
                </p>
              </div>

              <div className="form-grid booster-fields-grid">
                <input
                  onChange={(event) => updateBoosterProfile({ full_name: event.target.value })}
                  placeholder="Nome completo"
                  required
                  value={boosterProfile.full_name}
                />
                <input
                  onChange={(event) => updateBoosterProfile({ birth_date: event.target.value })}
                  required
                  type="date"
                  value={boosterProfile.birth_date}
                />
                <input
                  min={13}
                  onChange={(event) => updateBoosterProfile({ age: event.target.value })}
                  placeholder="Idade"
                  required
                  type="number"
                  value={boosterProfile.age}
                />
                <input
                  inputMode="numeric"
                  maxLength={14}
                  onChange={(event) => updateBoosterProfile({ cpf: maskCpf(event.target.value) })}
                  placeholder="CPF"
                  required
                  value={boosterProfile.cpf}
                />
                <input
                  onChange={(event) => updateBoosterProfile({ pix_key: event.target.value })}
                  placeholder="Sua chave Pix"
                  required
                  value={boosterProfile.pix_key}
                />
                <select
                  onChange={(event) => updateBoosterProfile({ gender: event.target.value })}
                  required
                  value={boosterProfile.gender}
                >
                  <option value="">Gênero</option>
                  <option value="female">Feminino</option>
                  <option value="male">Masculino</option>
                  <option value="non_binary">Não-binário</option>
                  <option value="prefer_not_to_say">Prefiro não informar</option>
                  <option value="other">Outro</option>
                </select>
                <input
                  onChange={(event) => updateBoosterProfile({ in_game_nick: event.target.value })}
                  placeholder="Qual seu nick dentro do jogo?"
                  required
                  value={boosterProfile.in_game_nick}
                />
                <input
                  onChange={(event) => updateBoosterProfile({ highest_rank: event.target.value })}
                  placeholder="Qual seu maior rank alcançado?"
                  required
                  value={boosterProfile.highest_rank}
                />
                <input
                  onChange={(event) => updateBoosterProfile({ previous_season_rank: event.target.value })}
                  placeholder="Qual seu rank da season passada?"
                  required
                  value={boosterProfile.previous_season_rank}
                />
                <input
                  onChange={(event) => updateBoosterProfile({ location: event.target.value })}
                  placeholder="Estado e cidade onde reside"
                  required
                  value={boosterProfile.location}
                />
                <input
                  onChange={(event) => updateBoosterProfile({ opgg_url: event.target.value })}
                  placeholder="Link do OP.GG"
                  required
                  value={boosterProfile.opgg_url}
                />
                <input
                  onChange={(event) => updateBoosterProfile({ discord_username: event.target.value })}
                  placeholder="Nome de usuário no Discord"
                  required
                  value={boosterProfile.discord_username}
                />
                <input
                  onChange={(event) => updateBoosterProfile({ diamond_plus_eta: event.target.value })}
                  placeholder="Em quanto tempo upa uma conta para Diamante+?"
                  required
                  value={boosterProfile.diamond_plus_eta}
                />
                <input
                  max={100}
                  min={0}
                  onChange={(event) => updateBoosterProfile({ initial_percentage: event.target.value })}
                  placeholder="Porcentagem inicial"
                  required
                  type="number"
                  value={boosterProfile.initial_percentage}
                />
                <textarea
                  className="field-span-2"
                  onChange={(event) => updateBoosterProfile({ available_hours: event.target.value })}
                  placeholder="Quais são seus horários disponíveis?"
                  required
                  rows={3}
                  value={boosterProfile.available_hours}
                />
              </div>

            </section>
          ) : null}

          <button className="primary-button" disabled={isSaving} type="submit">
            {isSaving ? 'Salvando...' : editingUser ? 'Salvar alterações' : 'Cadastrar usuário'}
          </button>
        </form>

        <section className="management-panel panel">
          <span className="panel__eyebrow">Listagem</span>
          <h2>Usuários cadastrados</h2>
          <div className="data-table">
            <div className="data-table__row data-table__row--head">
              <span>Nome</span>
              <span>Email</span>
              <span>Perfil</span>
              <span>Status</span>
              <span>Ações</span>
            </div>
            {payload?.users.data.map((target) => {
              const isCurrentUser = target.id === user?.id

              return (
                <div className="data-table__row" key={target.id}>
                  <strong>{target.name}</strong>
                  <span>{target.email}</span>
                  <span>{target.role_label ?? target.role}</span>
                  <span>{target.is_active ? 'Ativo' : 'Desativado'}</span>
                  <div className="row-actions">
                    <button className="ghost-button" onClick={() => handleEdit(target)} type="button">
                      <Edit3 size={15} />
                      Editar
                    </button>
                    <button
                      className="ghost-button"
                      disabled={isCurrentUser}
                      onClick={() => void handleToggleActive(target)}
                      title={isCurrentUser ? 'Você não pode desativar sua própria sessão.' : undefined}
                      type="button"
                    >
                      {target.is_active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      className="ghost-button danger-button"
                      disabled={isCurrentUser}
                      onClick={() => void handleDelete(target)}
                      title={isCurrentUser ? 'Você não pode excluir sua própria conta logada.' : undefined}
                      type="button"
                    >
                      <Trash2 size={15} />
                      Excluir
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <ConfirmDialog
          cancelLabel="Manter usuário"
          confirmLabel="Excluir usuário"
          description={
            deleteTarget
              ? `Você está prestes a remover ${deleteTarget.name} da plataforma. Essa ação não pode ser desfeita.`
              : undefined
          }
          isLoading={isDeleting}
          onClose={() => {
            if (!isDeleting) {
              setDeleteTarget(null)
            }
          }}
          onConfirm={() => void confirmDelete()}
          open={Boolean(deleteTarget)}
          title="Excluir este usuário?"
          tone="danger"
        />
      </div>
    </AppShell>
  )
}
