import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Landmark,
  Loader2,
  QrCode,
  ReceiptText,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'

import { AppShell } from '@/components/AppShell'
import { getBoosterPayoutAmount } from '@/config/payout'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { PaymentTransaction, ServiceOrder, WithdrawalRequest } from '@/types/system'
import { hasPermission } from '@/utils/authz'

function formatCurrency(value: number | string) {
  const numeric = Number(value)

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(numeric > 999 ? numeric / 100 : numeric)
}

function formatDate(value?: string | null) {
  if (!value) return 'Hoje'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatProvider(provider: PaymentTransaction['provider']) {
  if (provider === 'MERCADO_PAGO' || provider === 'mercado_pago') return 'Mercado Pago'
  if (provider === 'STRIPE' || provider === 'stripe') return 'Stripe'
  return 'Manual'
}

function formatMethod(method: PaymentTransaction['method']) {
  if (method === 'PIX' || method === 'pix') return 'Pix'
  if (method === 'DEBIT_CARD') return 'Débito'
  return 'Cartão'
}

function statusLabel(status?: string | null) {
  const normalized = status?.toLowerCase()
  const labels: Record<string, string> = {
    paid: 'Pago',
    approved: 'Aprovado',
    pending: 'Pendente',
    processing: 'Processando',
    waiting_payment: 'Aguardando',
    requires_action: 'Ação necessária',
    rejected: 'Rejeitado',
    failed: 'Falhou',
    cancelled: 'Cancelado',
    expired: 'Expirado',
    refunded: 'Reembolsado',
  }

  return labels[normalized ?? ''] ?? status ?? 'Pendente'
}

function statusTone(status?: string | null) {
  const normalized = status?.toLowerCase()
  if (normalized === 'paid' || normalized === 'approved') return 'success'
  if (normalized === 'failed' || normalized === 'cancelled' || normalized === 'rejected' || normalized === 'expired') return 'danger'
  if (normalized === 'processing') return 'active'

  return 'waiting'
}

function getWithdrawalOrderId(withdrawal: WithdrawalRequest) {
  const value = withdrawal.metadata?.service_order_id

  return typeof value === 'number' ? value : Number(value ?? 0)
}

function getOrderWithdrawalAmount(order: ServiceOrder) {
  return getBoosterPayoutAmount(order.final_price ?? order.latest_payment?.finalAmount ?? order.latest_payment?.amount ?? order.price)
}

function metadataNumber(value: unknown) {
  const numeric = Number(value ?? 0)

  return Number.isFinite(numeric) ? numeric : 0
}

function getOrderGrossAmount(order: ServiceOrder) {
  return Number(order.final_price ?? order.latest_payment?.finalAmount ?? order.latest_payment?.amount ?? order.price)
}

function emv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

function crc16(payload: string) {
  let crc = 0xffff

  for (let index = 0; index < payload.length; index += 1) {
    crc ^= payload.charCodeAt(index) << 8
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xffff
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function createPixPayload(pixKey: string, amount: number, txid: string) {
  const merchantAccount = emv('00', 'br.gov.bcb.pix') + emv('01', pixKey) + emv('02', 'Saque Horizon Boost')
  const additionalData = emv('05', txid.replace(/[^A-Z0-9]/gi, '').slice(0, 25) || 'HORIZON')
  const payload =
    emv('00', '01') +
    emv('26', merchantAccount) +
    emv('52', '0000') +
    emv('53', '986') +
    emv('54', amount.toFixed(2)) +
    emv('58', 'BR') +
    emv('59', 'HORIZON BOOST') +
    emv('60', 'SAO PAULO') +
    emv('62', additionalData)
  const payloadWithCrc = `${payload}6304`

  return `${payloadWithCrc}${crc16(payloadWithCrc)}`
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof Wallet
  label: string
  value: string | number
  helper: string
}) {
  return (
    <article className="finance-metric-card">
      <div className="finance-metric-card__icon">
        <Icon size={20} />
      </div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  )
}

export function FinancePage() {
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [payments, setPayments] = useState<PaymentTransaction[]>([])
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [requestingOrderId, setRequestingOrderId] = useState<number | null>(null)
  const [withdrawalOrder, setWithdrawalOrder] = useState<ServiceOrder | null>(null)
  const [reviewWithdrawal, setReviewWithdrawal] = useState<WithdrawalRequest | null>(null)
  const [bonusAmount, setBonusAmount] = useState('')
  const [reviewBonusAmount, setReviewBonusAmount] = useState('')
  const [generatedPix, setGeneratedPix] = useState<{ payload: string; dataUrl: string; amount: number } | null>(null)
  const [reviewPix, setReviewPix] = useState<{ payload: string; dataUrl: string; amount: number } | null>(null)
  const canRequestWithdrawal = user?.role === 'booster' && hasPermission(user, 'finance.withdrawals.request')
  const canManageWithdrawals = hasPermission(user, 'finance.withdrawals.manage')
  const canSeeWithdrawals = canRequestWithdrawal || canManageWithdrawals

  const financeSummary = useMemo(() => {
    const paidVolume = payments
      .filter((payment) => ['paid', 'approved'].includes(payment.status.toLowerCase()))
      .reduce((total, payment) => total + Number(payment.amount), 0)
    const pendingWithdrawals = withdrawals.filter((withdrawal) => withdrawal.status.toLowerCase() === 'pending')
    const blockedWithdrawalOrderIds = new Set(
      withdrawals
        .filter((withdrawal) => ['pending', 'approved', 'paid'].includes(withdrawal.status.toLowerCase()))
        .map(getWithdrawalOrderId)
        .filter(Boolean),
    )
    const withdrawableOrders = orders.filter(
      (order) => order.status === 'COMPLETED' && !blockedWithdrawalOrderIds.has(order.id),
    )
    const withdrawableVolume = withdrawableOrders.reduce((total, order) => total + Number(getOrderWithdrawalAmount(order)), 0)

    return {
      paidVolume,
      pendingWithdrawals: pendingWithdrawals.length,
      withdrawableOrders,
      withdrawableVolume,
    }
  }, [orders, payments, withdrawals])

  async function loadFinance() {
    const [nextPayments, nextWithdrawals, nextOrders] = await Promise.all([
      systemService.getPayments(),
      canSeeWithdrawals ? systemService.getWithdrawals() : Promise.resolve([]),
      canRequestWithdrawal ? systemService.getOrders() : Promise.resolve([]),
    ])

    setPayments(nextPayments)
    setWithdrawals(nextWithdrawals)
    setOrders(nextOrders)
  }

  useEffect(() => {
    let active = true

    async function bootstrapFinance() {
      setIsLoading(true)

      try {
        const [nextPayments, nextWithdrawals, nextOrders] = await Promise.all([
          systemService.getPayments(),
          canSeeWithdrawals ? systemService.getWithdrawals() : Promise.resolve([]),
          canRequestWithdrawal ? systemService.getOrders() : Promise.resolve([]),
        ])

        if (!active) return

        setPayments(nextPayments)
        setWithdrawals(nextWithdrawals)
        setOrders(nextOrders)
      } catch (error: unknown) {
        if (active) {
          addToast({
            tone: 'error',
            title: 'Financeiro indisponível',
            description: getApiErrorMessage(error, 'Não foi possível carregar os dados financeiros agora.'),
          })
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void bootstrapFinance()

    return () => {
      active = false
    }
  }, [addToast, canRequestWithdrawal, canSeeWithdrawals])

  async function handleLogout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  function openWithdrawalModal(order: ServiceOrder) {
    setWithdrawalOrder(order)
    setBonusAmount('')
    setGeneratedPix(null)
  }

  async function handleWithdrawal(order: ServiceOrder) {
    const pixKey = user?.booster_profile?.pix_key?.trim()

    if (!pixKey) {
      addToast({
        tone: 'error',
        title: 'Chave Pix não cadastrada',
        description: 'Cadastre sua chave Pix no perfil antes de solicitar saque.',
      })
      return
    }

    setRequestingOrderId(order.id)

    try {
      const bonus = Number(bonusAmount || 0)
      const amount = getOrderWithdrawalAmount(order) + bonus
      const payload = createPixPayload(pixKey, amount, `HB${order.id}`)
      const dataUrl = await QRCode.toDataURL(payload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 220,
      })
      await systemService.requestWithdrawal({
        service_order_id: order.id,
        method: 'pix',
        pix_key: pixKey,
        bonus_amount: bonus,
        metadata: { pix_payload: payload },
      })
      await loadFinance()
      setGeneratedPix({ payload, dataUrl, amount })
      addToast({
        tone: 'success',
        title: 'QR Code gerado',
        description: 'A solicitação foi criada com o valor final e a chave Pix do cadastro.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Saque não enviado',
        description: getApiErrorMessage(error, 'Tente novamente em alguns instantes.'),
      })
    } finally {
      setRequestingOrderId(null)
    }
  }

  async function handleCopyPix(payload: string) {
    await navigator.clipboard.writeText(payload)
    addToast({
      tone: 'success',
      title: 'Pix copiado',
      description: 'O código Pix foi copiado para a área de transferência.',
    })
  }

  async function handleReview(id: number, status: 'approved' | 'rejected' | 'paid') {
    try {
      await systemService.reviewWithdrawal(id, status)
      await loadFinance()
      addToast({
        tone: 'success',
        title: 'Saque atualizado',
        description: 'A solicitação foi atualizada com sucesso.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível atualizar',
        description: getApiErrorMessage(error, 'Tente novamente em alguns instantes.'),
      })
    }
  }

  function openReviewPixModal(withdrawal: WithdrawalRequest) {
    const pixKey = withdrawal.pix_key?.trim()

    if (!pixKey) {
      addToast({
        tone: 'error',
        title: 'Saque sem chave Pix',
        description: 'Não existe chave Pix vinculada a essa solicitação.',
      })
      return
    }

    setReviewWithdrawal(withdrawal)
    setReviewBonusAmount(String(metadataNumber(withdrawal.metadata?.bonus_amount) || 0))
    setReviewPix(null)
  }

  async function generateReviewPix() {
    if (!reviewWithdrawal?.pix_key) return

    const baseAmount = metadataNumber(reviewWithdrawal.metadata?.base_payout_amount) || Number(reviewWithdrawal.amount)
    const bonus = Number(reviewBonusAmount || 0)
    const amount = baseAmount + bonus
    const payload = createPixPayload(reviewWithdrawal.pix_key, amount, `SAQUE${reviewWithdrawal.id}`)
    const dataUrl = await QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 220,
    })

    setReviewPix({ payload, dataUrl, amount })
  }

  return (
    <AppShell onLogout={handleLogout} userName={user?.name ?? 'Usuário'}>
      <div className="finance-page finance-page--premium">
        <section className="finance-hero panel">
          <div className="finance-hero__copy">
            <span className="panel__eyebrow">Financeiro</span>
            <h1>Saques dos boosts</h1>
            <p>Finalize um serviço, libere o boost para saque e acompanhe cada solicitação por pedido.</p>
          </div>

          <div className="finance-hero__highlight">
            <span>Disponível para solicitar</span>
            <strong>{formatCurrency(financeSummary.withdrawableVolume)}</strong>
            <small>{financeSummary.withdrawableOrders.length} boost(s) finalizado(s)</small>
          </div>
        </section>

        <section className="finance-metric-grid">
          <SummaryMetric
            helper="Boosts finalizados sem saque"
            icon={Landmark}
            label="Disponível"
            value={formatCurrency(financeSummary.withdrawableVolume)}
          />
          <SummaryMetric
            helper="Solicitações aguardando análise"
            icon={Banknote}
            label="Saques pendentes"
            value={financeSummary.pendingWithdrawals}
          />
          <SummaryMetric helper="Pagamentos registrados" icon={ReceiptText} label="Transações" value={payments.length} />
          <SummaryMetric helper="Histórico aprovado" icon={Wallet} label="Volume pago" value={formatCurrency(financeSummary.paidVolume)} />
        </section>

        <section className={`finance-primary-layout${canRequestWithdrawal ? '' : ' finance-primary-layout--single'}`}>
          {canRequestWithdrawal ? (
            <article className="finance-panel panel finance-withdrawal-panel finance-withdrawal-panel--primary">
              <div className="finance-panel__header">
                <div>
                  <span className="panel__eyebrow">Pronto para saque</span>
                  <h2>Boosts finalizados</h2>
                </div>
                <Banknote size={22} />
              </div>

              {isLoading ? (
                <div className="finance-empty-state">
                  <Loader2 className="spin-icon" size={38} />
                  <strong>Carregando boosts</strong>
                </div>
              ) : financeSummary.withdrawableOrders.length ? (
                <div className="finance-withdrawable-grid">
                  {financeSummary.withdrawableOrders.map((order) => (
                    <article className="finance-withdrawable-card" key={order.id}>
                      <div>
                        <span>Pedido #{order.id}</span>
                        <strong>{order.title}</strong>
                        <small>Finalizado em {formatDate(order.completed_at ?? order.updated_at)}</small>
                      </div>
                      <div className="finance-withdrawable-card__action">
                        <strong>{formatCurrency(getOrderWithdrawalAmount(order))}</strong>
                        <button
                          className="primary-button primary-button--crimson"
                          disabled={requestingOrderId === order.id}
                          onClick={() => openWithdrawalModal(order)}
                          type="button"
                        >
                          Solicitar saque
                          <ArrowUpRight size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="finance-empty-state">
                  <CheckCircle2 size={42} />
                  <strong>Nenhum boost liberado</strong>
                  <span>Finalize um serviço em Meus serviços para liberar o saque aqui.</span>
                </div>
              )}
            </article>
          ) : null}

          {canSeeWithdrawals ? (
            <article className="finance-panel panel finance-withdrawal-panel">
              <div className="finance-panel__header">
                <div>
                  <span className="panel__eyebrow">Histórico de saques</span>
                  <h2>Solicitações</h2>
                </div>
                <Clock3 size={22} />
              </div>

              {isLoading ? (
                <div className="finance-empty-state">
                  <Loader2 className="spin-icon" size={38} />
                  <strong>Carregando saques</strong>
                </div>
              ) : withdrawals.length ? (
                <div className="finance-withdrawal-list">
                  {withdrawals.map((withdrawal) => (
                    <article className="finance-withdrawal-card" key={withdrawal.id}>
                      <div>
                        <strong>{formatCurrency(withdrawal.amount)}</strong>
                        <span>
                          {(typeof withdrawal.metadata?.service_order_title === 'string' ? withdrawal.metadata.service_order_title : withdrawal.booster?.name) ?? 'Meu saque'} · {formatDate(withdrawal.requested_at ?? withdrawal.created_at)}
                        </span>
                        {withdrawal.pix_key ? <small>Pix: {withdrawal.pix_key}</small> : null}
                      </div>
                      <span className={`finance-status is-${statusTone(withdrawal.status)}`}>{statusLabel(withdrawal.status)}</span>
                      {canManageWithdrawals ? (
                        <div className="finance-withdrawal-card__actions">
                          <button className="ghost-button" onClick={() => void openReviewPixModal(withdrawal)} type="button">
                            <CheckCircle2 size={15} />
                            Aprovar
                          </button>
                          <button className="ghost-button" onClick={() => void handleReview(withdrawal.id, 'rejected')} type="button">
                            <XCircle size={15} />
                            Rejeitar
                          </button>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="finance-empty-state">
                  <Clock3 size={42} />
                  <strong>Nenhum saque registrado</strong>
                  <span>As solicitações de retirada aparecem aqui.</span>
                </div>
              )}
            </article>
          ) : null}
        </section>

        <section className="finance-panel panel finance-history-panel">
          <div className="finance-panel__header">
            <div>
              <span className="panel__eyebrow">Histórico</span>
              <h2>Pagamentos registrados</h2>
            </div>
            <CreditCard size={22} />
          </div>

          {isLoading ? (
            <div className="finance-empty-state">
              <Loader2 className="spin-icon" size={38} />
              <strong>Carregando transações</strong>
            </div>
          ) : payments.length ? (
            <div className="finance-transaction-list">
              {payments.map((payment) => (
                <article className="finance-transaction-card" key={payment.id}>
                  <div className="finance-transaction-card__icon">
                    <ReceiptText size={18} />
                  </div>
                  <div className="finance-transaction-card__body">
                    <strong>{payment.service_order?.title ?? 'Pagamento Horizon'}</strong>
                    <span>
                      {formatProvider(payment.provider)} · {formatMethod(payment.method)} · {formatDate(payment.created_at ?? payment.createdAt)}
                    </span>
                  </div>
                  <div className="finance-transaction-card__amount">
                    <strong>{formatCurrency(payment.amount)}</strong>
                    <span className={`finance-status is-${statusTone(payment.status)}`}>{statusLabel(payment.status)}</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="finance-empty-state">
              <ReceiptText size={42} />
              <strong>Nenhuma transação ainda</strong>
              <span>Quando um pagamento for registrado, ele aparece aqui.</span>
            </div>
          )}
        </section>

        {withdrawalOrder ? (
          <div className="modal-backdrop" onMouseDown={() => setWithdrawalOrder(null)}>
            <section className="finance-withdrawal-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
              <button
                aria-label="Fechar"
                className="confirm-modal__close"
                onClick={() => setWithdrawalOrder(null)}
                type="button"
              >
                <X size={18} />
              </button>

              <div className="finance-panel__header">
                <div>
                  <span className="panel__eyebrow">Solicitação Pix</span>
                  <h2>{generatedPix ? 'QR Code gerado' : 'Conferir valores'}</h2>
                </div>
                <QrCode size={22} />
              </div>

              <div className="finance-withdrawal-summary">
                <div>
                  <span>Valor total do boost</span>
                  <strong>{formatCurrency(getOrderGrossAmount(withdrawalOrder))}</strong>
                </div>
                <div>
                  <span>Valor do booster</span>
                  <strong>{formatCurrency(getOrderWithdrawalAmount(withdrawalOrder))}</strong>
                </div>
                <div>
                  <span>Bônus adicional</span>
                  <strong>{formatCurrency(Number(bonusAmount || 0))}</strong>
                </div>
                <div className="finance-withdrawal-summary__total">
                  <span>Total do Pix</span>
                  <strong>{formatCurrency(getOrderWithdrawalAmount(withdrawalOrder) + Number(bonusAmount || 0))}</strong>
                </div>
              </div>

              <div className="finance-withdrawal-pix-key">
                <span>Chave Pix do cadastro</span>
                <strong>{user?.booster_profile?.pix_key || 'Chave Pix não cadastrada'}</strong>
              </div>

              {!generatedPix ? (
                <>
                  <label className="finance-withdrawal-bonus">
                    <span>Adicionar valor extra para o booster</span>
                    <input
                      min="0"
                      onChange={(event) => setBonusAmount(event.target.value)}
                      placeholder="0,00"
                      type="number"
                      value={bonusAmount}
                    />
                  </label>

                  <button
                    className="primary-button primary-button--crimson"
                    disabled={requestingOrderId === withdrawalOrder.id || !user?.booster_profile?.pix_key}
                    onClick={() => void handleWithdrawal(withdrawalOrder)}
                    type="button"
                  >
                    {requestingOrderId === withdrawalOrder.id ? 'Gerando...' : 'Gerar QR Code Pix'}
                    <ArrowUpRight size={16} />
                  </button>
                </>
              ) : (
                <div className="finance-withdrawal-qr">
                  <img alt="QR Code Pix do saque" src={generatedPix.dataUrl} />
                  <textarea readOnly rows={4} value={generatedPix.payload} />
                  <button className="ghost-button" onClick={() => void handleCopyPix(generatedPix.payload)} type="button">
                    <Copy size={16} />
                    Copiar Pix
                  </button>
                </div>
              )}
            </section>
          </div>
        ) : null}

        {reviewWithdrawal ? (
          <div className="modal-backdrop" onMouseDown={() => setReviewWithdrawal(null)}>
            <section className="finance-withdrawal-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
              <button
                aria-label="Fechar"
                className="confirm-modal__close"
                onClick={() => {
                  setReviewWithdrawal(null)
                  setReviewPix(null)
                }}
                type="button"
              >
                <X size={18} />
              </button>

              <div className="finance-panel__header">
                <div>
                  <span className="panel__eyebrow">Aprovar saque</span>
                  <h2>{reviewPix ? 'Pagamento Pix' : 'Conferir valores'}</h2>
                </div>
                <QrCode size={22} />
              </div>

              <div className="finance-withdrawal-summary">
                <div>
                  <span>Valor total do saque</span>
                  <strong>{formatCurrency(reviewWithdrawal.amount)}</strong>
                </div>
                <div>
                  <span>Valor do booster</span>
                  <strong>{formatCurrency(metadataNumber(reviewWithdrawal.metadata?.base_payout_amount) || reviewWithdrawal.amount)}</strong>
                </div>
                <div>
                  <span>Bônus adicional</span>
                  <strong>{formatCurrency(Number(reviewBonusAmount || 0))}</strong>
                </div>
                <div className="finance-withdrawal-summary__total">
                  <span>Total do Pix</span>
                  <strong>{formatCurrency((metadataNumber(reviewWithdrawal.metadata?.base_payout_amount) || Number(reviewWithdrawal.amount)) + Number(reviewBonusAmount || 0))}</strong>
                </div>
              </div>

              <div className="finance-withdrawal-pix-key">
                <span>Chave Pix do booster</span>
                <strong>{reviewWithdrawal.pix_key}</strong>
              </div>

              {!reviewPix ? (
                <>
                  <label className="finance-withdrawal-bonus">
                    <span>Adicionar valor extra para o booster</span>
                    <input
                      min="0"
                      onChange={(event) => setReviewBonusAmount(event.target.value)}
                      placeholder="0,00"
                      type="number"
                      value={reviewBonusAmount}
                    />
                  </label>

                  <button className="primary-button primary-button--crimson" onClick={() => void generateReviewPix()} type="button">
                    Gerar QR Code Pix
                    <ArrowUpRight size={16} />
                  </button>
                </>
              ) : (
                <div className="finance-withdrawal-qr">
                  <img alt="QR Code Pix do saque" src={reviewPix.dataUrl} />
                  <textarea readOnly rows={3} value={reviewPix.payload} />
                  <button className="ghost-button" onClick={() => void handleCopyPix(reviewPix.payload)} type="button">
                    <Copy size={16} />
                    Copiar Pix
                  </button>
                </div>
              )}

              <div className="finance-withdrawal-modal__actions">
                <button
                  className="primary-button primary-button--crimson"
                  disabled={!reviewPix}
                  onClick={() => {
                    void handleReview(reviewWithdrawal.id, 'approved')
                    setReviewWithdrawal(null)
                    setReviewPix(null)
                  }}
                  type="button"
                >
                  Confirmar aprovação
                </button>
                <button
                  className="ghost-button"
                  onClick={() => {
                    setReviewWithdrawal(null)
                    setReviewPix(null)
                  }}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </AppShell>
  )
}
