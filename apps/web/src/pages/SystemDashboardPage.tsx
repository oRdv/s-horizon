import { useEffect, useState } from 'react'
import axios from 'axios'
import {
  BadgeDollarSign,
  Banknote,
  ClipboardList,
  Pencil,
  ShieldCheck,
  ShoppingBag,
  Target,
  Trash2,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { ChatModal } from '@/components/chat/ChatModal'
import { OrderChatButton } from '@/components/chat/OrderChatButton'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService, type LandingBoosterPayload, type RoleDashboard } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type {
  BoosterDashboard,
  CustomerDashboard,
  LandingBooster,
  MasterDashboard,
  PaymentTransaction,
  ServiceOrder,
  StaffDashboard,
} from '@/types/system'
import { getRoleDashboardLabel, hasPermission } from '@/utils/authz'

function formatCurrency(value: number | string) {
  const numeric = Number(value)

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(numeric > 999 ? numeric / 100 : numeric)
}

function formatPaymentMethod(method: PaymentTransaction['method']) {
  if (method === 'PIX' || method === 'pix') return 'Pix'
  if (method === 'DEBIT_CARD') return 'Debito'
  return 'Credito'
}

function formatPaymentProvider(provider: PaymentTransaction['provider']) {
  if (provider === 'MERCADO_PAGO' || provider === 'mercado_pago') {
    return 'Mercado Pago'
  }

  return provider === 'STRIPE' || provider === 'stripe' ? 'Stripe' : 'Manual'
}

const landingBoosterRanks: Array<{ key: LandingBooster['rank_key']; label: string }> = [
  { key: 'iron', label: 'Ferro' },
  { key: 'bronze', label: 'Bronze' },
  { key: 'silver', label: 'Prata' },
  { key: 'gold', label: 'Ouro' },
  { key: 'platinum', label: 'Platina' },
  { key: 'emerald', label: 'Esmeralda' },
  { key: 'diamond', label: 'Diamante' },
  { key: 'master', label: 'Mestre' },
  { key: 'grandmaster', label: 'Grão-Mestre' },
  { key: 'challenger', label: 'Desafiante' },
]

interface LandingBoosterFormState {
  user_id: string
  nick: string
  champion_name: string
  rank_label: string
  rank_key: LandingBooster['rank_key']
  game: string
  sort_order: string
  is_active: boolean
}

function getEmptyLandingBoosterForm(nextSortOrder: number): LandingBoosterFormState {
  return {
    user_id: '',
    nick: '',
    champion_name: '',
    rank_label: 'Mestre',
    rank_key: 'master',
    game: 'League of Legends',
    sort_order: String(nextSortOrder),
    is_active: true,
  }
}

function sortLandingBoosters(boosters: LandingBooster[]) {
  return [...boosters].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
}

function getOrderRouteLabel(order: ServiceOrder) {
  const ladderText = order.metadata?.ladder_text

  return typeof ladderText === 'string' && ladderText.trim().length ? ladderText : order.title
}

function getOrderModeLabel(order: ServiceOrder) {
  const mode = order.metadata?.calculator_mode

  if (mode === 'solo') {
    return 'Solo Boost'
  }

  if (mode === 'duo') {
    return 'Duo Boost'
  }

  if (mode === 'wins') {
    return 'Wins'
  }

  if (mode === 'md5') {
    return 'MD5'
  }

  if (mode === 'coaching') {
    return 'Coaching'
  }

  return 'Serviço'
}

export function SystemDashboardPage() {
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const clearSession = useSessionStore((state) => state.clearSession)
  const [dashboard, setDashboard] = useState<RoleDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      if (!user) {
        return
      }

      setIsLoading(true)

      try {
        const payload = await systemService.getDashboard(user.role)

        if (!active) {
          return
        }

        setDashboard(payload)
        setIsLoading(false)
      } catch (error) {
        if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
          clearSession()
          navigate('/login', { replace: true })
          return
        }

        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      active = false
    }
  }, [clearSession, navigate, user])

  async function handleLogout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  if (!user || isLoading || !dashboard) {
    return (
      <div className="loading-screen">
        <div className="loading-screen__mark">
          <span className="panel__eyebrow">Horizon Boost</span>
          <strong>Carregando dashboard...</strong>
        </div>
      </div>
    )
  }

  return (
    <AppShell onLogout={handleLogout} userName={user.name}>
      <div className="system-dashboard">
        <section className="system-hero panel">
          <div>
            <span className="panel__eyebrow">{getRoleDashboardLabel(user.role)}</span>
            <h1>Central Horizon Boost</h1>
          </div>

          <div className="system-hero__actions">
            {hasPermission(user, 'users.view_all') ? (
              <Link className="primary-button" to="/admin/users">
                Gerenciar usuarios
              </Link>
            ) : null}
            <Link className="ghost-button" to="/profile">
              Seguranca da conta
            </Link>
          </div>
        </section>

        {user.role === 'master_admin' ? <MasterDashboardView dashboard={dashboard as MasterDashboard} /> : null}
        {user.role === 'staff' ? <StaffDashboardView dashboard={dashboard as StaffDashboard} /> : null}
        {user.role === 'booster' ? <BoosterDashboardView dashboard={dashboard as BoosterDashboard} /> : null}
        {user.role === 'customer' ? <CustomerDashboardView dashboard={dashboard as CustomerDashboard} /> : null}
      </div>
    </AppShell>
  )
}

function MasterDashboardView({ dashboard }: { dashboard: MasterDashboard }) {
  const addToast = useToastStore((state) => state.addToast)
  const [landingBoosters, setLandingBoosters] = useState(() => sortLandingBoosters(dashboard.landing_boosters ?? []))
  const [editingLandingBoosterId, setEditingLandingBoosterId] = useState<number | null>(null)
  const [isSavingLandingBooster, setIsSavingLandingBooster] = useState(false)
  const [deletingLandingBoosterId, setDeletingLandingBoosterId] = useState<number | null>(null)
  const [boosterForm, setBoosterForm] = useState<LandingBoosterFormState>(() =>
    getEmptyLandingBoosterForm((dashboard.landing_boosters?.length ?? 0) + 1),
  )

  function resetLandingBoosterForm(nextBoosters = landingBoosters) {
    setEditingLandingBoosterId(null)
    setBoosterForm(getEmptyLandingBoosterForm(nextBoosters.length + 1))
  }

  function updateLandingBoosterForm(field: keyof LandingBoosterFormState, value: string | boolean) {
    setBoosterForm((current) => ({ ...current, [field]: value }))
  }

  function handleEditLandingBooster(booster: LandingBooster) {
    setEditingLandingBoosterId(booster.id)
    setBoosterForm({
      user_id: booster.user_id ? String(booster.user_id) : '',
      nick: booster.nick,
      champion_name: booster.champion_name,
      rank_label: booster.rank_label,
      rank_key: booster.rank_key,
      game: booster.game,
      sort_order: String(booster.sort_order),
      is_active: booster.is_active,
    })
  }

  function buildLandingBoosterPayload(): LandingBoosterPayload {
    return {
      user_id: boosterForm.user_id ? Number(boosterForm.user_id) : null,
      nick: boosterForm.nick.trim(),
      champion_name: boosterForm.champion_name.trim(),
      rank_label: boosterForm.rank_label.trim(),
      rank_key: boosterForm.rank_key,
      game: boosterForm.game.trim(),
      sort_order: Number(boosterForm.sort_order || 0),
      is_active: boosterForm.is_active,
    }
  }

  async function handleSaveLandingBooster() {
    if (!boosterForm.nick.trim() || !boosterForm.champion_name.trim() || !boosterForm.rank_label.trim()) {
      addToast({
        tone: 'error',
        title: 'Preencha os dados do booster',
        description: 'Nick, campeão e elo são obrigatórios para aparecer no slider.',
      })
      return
    }

    setIsSavingLandingBooster(true)

    try {
      const payload = buildLandingBoosterPayload()
      const savedBooster = editingLandingBoosterId
        ? await systemService.updateLandingBooster(editingLandingBoosterId, payload)
        : await systemService.createLandingBooster(payload)
      const nextBoosters = sortLandingBoosters(
        editingLandingBoosterId
          ? landingBoosters.map((booster) => (booster.id === savedBooster.id ? savedBooster : booster))
          : [...landingBoosters, savedBooster],
      )

      setLandingBoosters(nextBoosters)
      resetLandingBoosterForm(nextBoosters)
      addToast({
        tone: 'success',
        title: editingLandingBoosterId ? 'Booster atualizado' : 'Booster adicionado',
        description: 'O slider da landing já vai usar essas informações.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível salvar',
        description: getApiErrorMessage(error, 'Revise os dados e tente novamente.'),
      })
    } finally {
      setIsSavingLandingBooster(false)
    }
  }

  async function handleDeleteLandingBooster(booster: LandingBooster) {
    setDeletingLandingBoosterId(booster.id)

    try {
      await systemService.deleteLandingBooster(booster.id)
      const nextBoosters = landingBoosters.filter((item) => item.id !== booster.id)

      setLandingBoosters(nextBoosters)
      if (editingLandingBoosterId === booster.id) {
        resetLandingBoosterForm(nextBoosters)
      }
      addToast({
        tone: 'success',
        title: 'Booster removido',
        description: 'Ele não aparece mais no slider da landing.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível remover',
        description: getApiErrorMessage(error, 'Tente novamente em instantes.'),
      })
    } finally {
      setDeletingLandingBoosterId(null)
    }
  }

  return (
    <>
      <section className="system-card-grid">
        <SummaryCard icon={Users} label="Clientes" value={dashboard.summary.total_clients} />
        <SummaryCard icon={ShieldCheck} label="Boosters" value={dashboard.summary.total_boosters} />
        <SummaryCard icon={ClipboardList} label="Staffs" value={dashboard.summary.total_staffs} />
        <SummaryCard icon={ShoppingBag} label="Pedidos" value={dashboard.summary.total_orders} />
        <SummaryCard icon={Banknote} label="Pagamentos pendentes" value={dashboard.summary.pending_payments} />
        <SummaryCard icon={BadgeDollarSign} label="Total faturado" value={formatCurrency(dashboard.summary.total_revenue)} />
      </section>

      <section className="system-grid-two">
        <article className="management-panel panel">
          <span className="panel__eyebrow">Metas globais</span>
          <h2>Operacao do mes</h2>
          <div className="metric-list">
            {Object.entries(dashboard.global_goals).length ? (
              Object.entries(dashboard.global_goals).map(([key, value]) => (
                <div key={key}>
                  <span>{key.replaceAll('_', ' ')}</span>
                  <strong>{value}</strong>
                </div>
              ))
            ) : (
              <p>Nenhuma meta global cadastrada ainda.</p>
            )}
          </div>
        </article>

        <article className="management-panel panel">
          <span className="panel__eyebrow">Solicitacoes de pagamento</span>
          <h2>Retiradas pendentes</h2>
          <div className="stack-list">
            {dashboard.pending_withdrawal_requests.length ? (
              dashboard.pending_withdrawal_requests.map((withdrawal) => (
                <div className="stack-list__item" key={withdrawal.id}>
                  <strong>{withdrawal.booster?.name ?? 'Booster'}</strong>
                  <span>{formatCurrency(withdrawal.amount)} aguardando revisao</span>
                </div>
              ))
            ) : (
              <p>Nenhuma retirada pendente agora.</p>
            )}
          </div>
        </article>
      </section>

      <article className="management-panel panel landing-boosters-admin">
        <div className="form-panel-title">
          <div>
            <span className="panel__eyebrow">Landing page</span>
            <h2>Boosters do slider</h2>
            <p>Cadastre os perfis que aparecem no carrossel inicial. Isso não muda o cadastro normal dos boosters.</p>
          </div>
        </div>

        <div className="landing-boosters-admin__layout">
          <form
            className="form-grid landing-booster-form"
            onSubmit={(event) => {
              event.preventDefault()
              void handleSaveLandingBooster()
            }}
          >
            <label className="field-with-helper">
              <span>Vincular cadastro</span>
              <select
                value={boosterForm.user_id}
                onChange={(event) => updateLandingBoosterForm('user_id', event.target.value)}
              >
                <option value="">Sem vínculo</option>
                {dashboard.booster_users.map((boosterUser) => (
                  <option key={boosterUser.id} value={boosterUser.id}>
                    {boosterUser.name} ({boosterUser.email})
                  </option>
                ))}
              </select>
              <small>Opcional: o card do slider pode apontar para um usuário booster já cadastrado.</small>
            </label>

            <label className="field-with-helper">
              <span>Nick</span>
              <input
                value={boosterForm.nick}
                onChange={(event) => updateLandingBoosterForm('nick', event.target.value)}
                placeholder="Ex.: Akshan"
              />
            </label>

            <label className="field-with-helper">
              <span>Campeão da foto</span>
              <input
                value={boosterForm.champion_name}
                onChange={(event) => updateLandingBoosterForm('champion_name', event.target.value)}
                placeholder="Ex.: Akshan"
              />
              <small>Use o nome do campeão como está no LoL para puxar a imagem da API.</small>
            </label>

            <label className="field-with-helper">
              <span>Elo exibido</span>
              <input
                value={boosterForm.rank_label}
                onChange={(event) => updateLandingBoosterForm('rank_label', event.target.value)}
                placeholder="Ex.: Grão-Mestre"
              />
            </label>

            <label className="field-with-helper">
              <span>Ícone do elo</span>
              <select
                value={boosterForm.rank_key}
                onChange={(event) =>
                  updateLandingBoosterForm('rank_key', event.target.value as LandingBooster['rank_key'])
                }
              >
                {landingBoosterRanks.map((rank) => (
                  <option key={rank.key} value={rank.key}>
                    {rank.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-with-helper">
              <span>Jogo</span>
              <input
                value={boosterForm.game}
                onChange={(event) => updateLandingBoosterForm('game', event.target.value)}
                placeholder="League of Legends"
              />
            </label>

            <label className="field-with-helper">
              <span>Ordem</span>
              <input
                min="0"
                type="number"
                value={boosterForm.sort_order}
                onChange={(event) => updateLandingBoosterForm('sort_order', event.target.value)}
              />
            </label>

            <label className="landing-booster-active-toggle field-span-2">
              <input
                checked={boosterForm.is_active}
                type="checkbox"
                onChange={(event) => updateLandingBoosterForm('is_active', event.target.checked)}
              />
              <span>Mostrar este booster no slider</span>
            </label>

            <div className="landing-booster-form__actions field-span-2">
              <button className="primary-button primary-button--crimson" disabled={isSavingLandingBooster} type="submit">
                {isSavingLandingBooster ? 'Salvando...' : editingLandingBoosterId ? 'Salvar edição' : 'Adicionar booster'}
              </button>
              {editingLandingBoosterId ? (
                <button className="ghost-button" onClick={() => resetLandingBoosterForm()} type="button">
                  Cancelar
                </button>
              ) : null}
            </div>
          </form>

          <div className="landing-booster-admin-list">
            {landingBoosters.length ? (
              landingBoosters.map((booster) => (
                <article className="landing-booster-admin-card" key={booster.id}>
                  <div>
                    <strong>{booster.nick}</strong>
                    <span>
                      {booster.champion_name} · {booster.rank_label} · {booster.game}
                    </span>
                    {booster.user ? <small>Vinculado a {booster.user.name}</small> : <small>Sem cadastro vinculado</small>}
                  </div>

                  <div className="landing-booster-admin-card__meta">
                    <span>{booster.is_active ? 'Ativo' : 'Oculto'}</span>
                    <span>Ordem {booster.sort_order}</span>
                  </div>

                  <div className="landing-booster-admin-card__actions">
                    <button
                      aria-label={`Editar ${booster.nick}`}
                      className="icon-button"
                      onClick={() => handleEditLandingBooster(booster)}
                      type="button"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      aria-label={`Remover ${booster.nick}`}
                      className="icon-button icon-button--danger"
                      disabled={deletingLandingBoosterId === booster.id}
                      onClick={() => void handleDeleteLandingBooster(booster)}
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p>Nenhum booster cadastrado para a landing ainda.</p>
            )}
          </div>
        </div>
      </article>
    </>
  )
}

function StaffDashboardView({ dashboard }: { dashboard: StaffDashboard }) {
  return (
    <>
      <section className="system-card-grid">
        <SummaryCard icon={ClipboardList} label="Pedidos ativos" value={dashboard.operation.active_orders} />
        <SummaryCard icon={Users} label="Boosters ativos" value={dashboard.operation.active_boosters} />
        <SummaryCard icon={Banknote} label="Retiradas pendentes" value={dashboard.finance.pending_withdrawals} />
        <SummaryCard icon={BadgeDollarSign} label="Receita do mes" value={formatCurrency(dashboard.finance.month_revenue)} />
      </section>

      <article className="management-panel panel">
        <span className="panel__eyebrow">Operacao</span>
        <h2>Pedidos recentes</h2>
        <div className="stack-list">
          {dashboard.operation.recent_orders.length ? (
            dashboard.operation.recent_orders.map((order) => (
              <div className="stack-list__item" key={order.id}>
                <strong>{order.title}</strong>
                <span>{order.status} · {order.customer?.name ?? 'Cliente sem nome'}</span>
              </div>
            ))
          ) : (
            <p>Nenhum pedido recente registrado.</p>
          )}
        </div>
      </article>
    </>
  )
}

function BoosterDashboardView({ dashboard }: { dashboard: BoosterDashboard }) {
  const addToast = useToastStore((state) => state.addToast)
  const [availableOrders, setAvailableOrders] = useState(dashboard.available_orders)
  const [assignedOrders, setAssignedOrders] = useState(dashboard.assigned_orders)
  const [progress, setProgress] = useState(dashboard.progress)
  const [claimingOrderId, setClaimingOrderId] = useState<number | null>(null)
  const [chatOrder, setChatOrder] = useState<ServiceOrder | null>(null)

  async function handleClaimOrder(orderId: number) {
    setClaimingOrderId(orderId)

    try {
      const claimedOrder = await systemService.claimBoosterOrder(orderId)

      setAvailableOrders((current) => current.filter((order) => order.id !== orderId))
      setAssignedOrders((current) => [claimedOrder, ...current.filter((order) => order.id !== claimedOrder.id)])
      setProgress((current) => ({
        ...current,
        active_orders: current.active_orders + 1,
      }))

      addToast({
        tone: 'success',
        title: 'Serviço pego',
        description: 'O pedido saiu da fila e entrou no seu inventario.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível pegar o serviço',
        description: getApiErrorMessage(error, 'Atualize a fila e tente novamente.'),
      })
    } finally {
      setClaimingOrderId(null)
    }
  }

  return (
    <>
      <section className="system-card-grid">
        <SummaryCard icon={ClipboardList} label="Pedidos ativos" value={progress.active_orders} />
        <SummaryCard icon={Target} label="Pedidos concluidos" value={progress.completed_orders} />
        <SummaryCard icon={BadgeDollarSign} label="Disponivel" value={formatCurrency(dashboard.earnings.available)} />
        <SummaryCard icon={Banknote} label="Saques pendentes" value={formatCurrency(dashboard.earnings.pending_withdrawals)} />
      </section>

      <article className="management-panel panel">
        <span className="panel__eyebrow">Fila disponivel</span>
        <h2>Serviços livres para pegar</h2>

        {availableOrders.length ? (
          <div className="booster-queue-grid">
            {availableOrders.map((order) => (
              <article className="booster-queue-card" key={order.id}>
                <span className="panel__eyebrow">Fila aberta</span>
                <h3>{getOrderRouteLabel(order)}</h3>
                <p>{getOrderModeLabel(order)} · {formatCurrency(order.price)}</p>

                <div className="booster-queue-card__meta">
                  <span>Cliente: {order.customer?.name ?? 'Cliente Horizon'}</span>
                  <span>Status: {order.status}</span>
                </div>

                <button
                  className="primary-button primary-button--crimson"
                  disabled={claimingOrderId === order.id}
                  onClick={() => void handleClaimOrder(order.id)}
                  type="button"
                >
                  {claimingOrderId === order.id ? 'Pegando...' : 'Pegar serviço'}
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p>Não existe serviço livre na fila agora.</p>
        )}
      </article>

      <article className="management-panel panel">
        <span className="panel__eyebrow">Meus serviços</span>
        <h2>Pedidos atribuidos</h2>
        <div className="stack-list">
          {assignedOrders.length ? (
            assignedOrders.map((order) => (
              <div className="stack-list__item" key={order.id}>
                <div>
                  <strong>{order.title}</strong>
                  <span>{order.status} · {formatCurrency(order.price)}</span>
                </div>
                <OrderChatButton onOpen={setChatOrder} order={{ ...order, chat_available: order.chat_available ?? true }} />
              </div>
            ))
          ) : (
            <p>Nenhum pedido atribuido ainda.</p>
          )}
        </div>
      </article>

      {chatOrder ? <ChatModal order={chatOrder} onClose={() => setChatOrder(null)} /> : null}
    </>
  )
}

function CustomerDashboardView({ dashboard }: { dashboard: CustomerDashboard }) {
  return (
    <>
      <section className="system-card-grid system-card-grid--three">
        <SummaryCard icon={ShoppingBag} label="Pedidos comprados" value={dashboard.history.total_orders} />
        <SummaryCard icon={Target} label="Concluidos" value={dashboard.history.completed_orders} />
        <SummaryCard icon={Banknote} label="Pagamentos" value={dashboard.payments.length} />
      </section>

      <section className="system-grid-two">
        <article className="management-panel panel">
          <span className="panel__eyebrow">Area do cliente</span>
          <h2>Pedidos e andamento</h2>
          <div className="stack-list">
            {dashboard.orders.length ? (
              dashboard.orders.map((order) => (
                <div className="stack-list__item" key={order.id}>
                  <strong>{order.title}</strong>
                  <span>{order.status} · {formatCurrency(order.price)}</span>
                </div>
              ))
            ) : (
              <>
                <p>Você ainda não tem pedidos. A tabela de preços completa fica na área de compras.</p>
                <Link className="primary-button" to="/purchases">
                  Abrir tabela completa
                </Link>
              </>
            )}
          </div>
        </article>

        <article className="management-panel panel payment-preview-panel">
          <span className="panel__eyebrow">Pagamentos</span>
          <h2>Histórico recente</h2>
          <div className="payment-preview-list">
            {dashboard.payments.length ? (
              dashboard.payments.map((payment) => (
                <div className="payment-preview-item" key={payment.id}>
                  <div>
                    <strong>{payment.service_order?.title ?? 'Pagamento Horizon'}</strong>
                    <span>
                      {formatPaymentProvider(payment.provider)} · {formatPaymentMethod(payment.method)} · {payment.status}
                    </span>
                  </div>
                  <div>
                    <strong>{formatCurrency(payment.amount)}</strong>
                  </div>
                </div>
              ))
            ) : (
              <p>Nenhum pagamento registrado ainda.</p>
            )}
          </div>
        </article>
      </section>
    </>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: number | string
}) {
  return (
    <article className="summary-card panel">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}
