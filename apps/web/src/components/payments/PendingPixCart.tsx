import { useEffect, useMemo, useState } from 'react'
import { Copy, Loader2, QrCode, RefreshCw, ShoppingCart, X } from 'lucide-react'
import QRCode from 'qrcode'

import { getApiErrorMessage } from '@/services/api/errors'
import { systemService } from '@/services/system'
import { useToastStore } from '@/store/useToastStore'
import type { PaymentGatewayPayload, PaymentTransaction, ServiceOrder } from '@/types/system'

const retryableStatuses = new Set(['WAITING_PAYMENT', 'PROCESSING', 'REQUIRES_ACTION', 'EXPIRED', 'FAILED'])
const pendingStatuses = new Set(['WAITING_PAYMENT', 'PROCESSING', 'REQUIRES_ACTION'])

interface PixItem {
  order: ServiceOrder
  payment: PaymentTransaction
}

function amountLabel(value?: number | string | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(Number(value ?? 0) / 100)
}

function expirationTime(payment: PaymentTransaction) {
  const timestamp = payment.expiresAt ? Date.parse(payment.expiresAt) : Number.NaN
  return Number.isFinite(timestamp) ? timestamp : null
}

function isExpired(payment: PaymentTransaction, now = Date.now()) {
  const expiresAt = expirationTime(payment)
  return payment.status === 'EXPIRED' || payment.status === 'FAILED' || (expiresAt !== null && expiresAt <= now)
}

function countdownLabel(expiresAt: number | null, now: number) {
  if (expiresAt === null) return 'Validade indisponível'
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  const minutes = Math.floor(seconds / 60)
  return seconds > 0 ? `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : 'Expirado'
}

function normalizeGateway(gateway: PaymentGatewayPayload & { payment: PaymentTransaction }): PaymentTransaction {
  return {
    ...gateway.payment,
    id: gateway.paymentId ?? gateway.payment.id,
    status: gateway.status ?? gateway.payment.status,
    qrCode: gateway.qrCode ?? gateway.payment.qrCode ?? null,
    qrCodeBase64: gateway.qrCodeBase64 ?? gateway.payment.qrCodeBase64 ?? null,
    pixCopyPaste: gateway.pixCopyPaste ?? gateway.payment.pixCopyPaste ?? null,
    expiresAt: gateway.expiresAt ?? gateway.payment.expiresAt ?? null,
  }
}

interface PendingPixCartProps {
  initialOrderId?: number | null
  onClose?: () => void
  orders: ServiceOrder[]
  showCart?: boolean
}

export function PendingPixCart({ initialOrderId, onClose, orders, showCart = true }: PendingPixCartProps) {
  const addToast = useToastStore((state) => state.addToast)
  const orderItems = useMemo(() => orders.flatMap((order) => (
    order.payments ?? (order.latest_payment ? [order.latest_payment] : [])
  )
    .filter((payment) => payment.method === 'PIX' && retryableStatuses.has(payment.status))
    .map((payment) => ({ order, payment }))), [orders])
  const [overrides, setOverrides] = useState<PixItem[]>([])
  const [selected, setSelected] = useState<PixItem | null>(() => (
    initialOrderId ? orderItems.find((item) => item.order.id === initialOrderId) ?? null : null
  ))
  const [generatedQr, setGeneratedQr] = useState<{ paymentId: number; url: string } | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [isRenewing, setIsRenewing] = useState(false)

  const items = useMemo(() => {
    const seen = new Set<number>()
    return [...overrides, ...orderItems].filter(({ payment }) => {
      if (seen.has(payment.id)) return false
      seen.add(payment.id)
      return true
    })
  }, [orderItems, overrides])

  useEffect(() => {
    if (!selected) return
    const timeout = window.setTimeout(() => setNow(Date.now()), 0)
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [selected])

  const selectedPaymentId = selected?.payment.id ?? null
  const selectedPaymentStatus = selected?.payment.status ?? null
  const selectedExpiresAt = selected?.payment.expiresAt ?? null
  const selectedQrCode = selected?.payment.qrCode ?? null
  const selectedQrBase64 = selected?.payment.qrCodeBase64 ?? null
  const selectedPixCopyPaste = selected?.payment.pixCopyPaste ?? null

  useEffect(() => {
    if (!selectedPaymentId || selectedQrBase64) return
    const payload = selectedQrCode ?? selectedPixCopyPaste
    if (!payload) return

    let active = true
    void QRCode.toDataURL(payload, { margin: 1, width: 280 }).then((value) => {
      if (active) setGeneratedQr({ paymentId: selectedPaymentId, url: value })
    })
    return () => { active = false }
  }, [selectedPaymentId, selectedPixCopyPaste, selectedQrBase64, selectedQrCode])

  useEffect(() => {
    if (!selectedPaymentId || !selectedPaymentStatus || !pendingStatuses.has(selectedPaymentStatus)) return

    let active = true
    const poll = async () => {
      try {
        const payment = await systemService.getPaymentStatus(selectedPaymentId)
        if (!active) return
        setSelected((current) => current?.payment.id === selectedPaymentId ? {
          ...current,
          payment: {
            ...current.payment,
            ...payment,
            qrCode: current.payment.qrCode ?? payment.qrCode,
            qrCodeBase64: current.payment.qrCodeBase64 ?? payment.qrCodeBase64,
            pixCopyPaste: current.payment.pixCopyPaste ?? payment.pixCopyPaste,
          },
        } : current)
      } catch {
        // Keep the recoverable PIX visible while the status endpoint is unavailable.
      }
    }

    void poll()
    const interval = window.setInterval(() => void poll(), 3000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [selectedPaymentId, selectedPaymentStatus, selectedExpiresAt])

  const visibleItems = useMemo(() => items
    .filter(({ payment }) => retryableStatuses.has(payment.status))
    .sort((left, right) => Number(right.payment.id) - Number(left.payment.id)), [items])

  async function copyCode(payment: PaymentTransaction) {
    if (!payment.pixCopyPaste) return
    try {
      await navigator.clipboard.writeText(payment.pixCopyPaste)
      addToast({ tone: 'success', title: 'Código PIX copiado', description: 'Cole no aplicativo do seu banco.' })
    } catch {
      addToast({ tone: 'error', title: 'Não foi possível copiar', description: 'Abra o PIX e copie o código manualmente.' })
    }
  }

  async function renewPix(item: PixItem) {
    setIsRenewing(true)
    try {
      const payment = normalizeGateway(await systemService.createPayment({
        boostId: item.order.id,
        orderId: item.order.id,
        method: 'PIX',
      }))
      const nextItem = { order: item.order, payment }
      setOverrides((current) => [
        nextItem,
        { ...item, payment: { ...item.payment, status: 'EXPIRED' } },
        ...current.filter((entry) => entry.payment.id !== item.payment.id && entry.payment.id !== payment.id),
      ])
      setSelected(nextItem)
      addToast({ tone: 'success', title: 'Novo PIX gerado', description: `O pedido #${item.order.id} foi mantido.` })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível gerar o PIX',
        description: getApiErrorMessage(error, 'Tente novamente em instantes.'),
      })
    } finally {
      setIsRenewing(false)
    }
  }

  const selectedExpired = selected ? isExpired(selected.payment, now) : false
  const selectedExpiry = selected ? expirationTime(selected.payment) : null
  const generatedQrUrl = generatedQr && generatedQr.paymentId === selectedPaymentId ? generatedQr.url : null
  const qrDataUrl = selected?.payment.qrCodeBase64
    ? (selected.payment.qrCodeBase64.startsWith('data:image')
        ? selected.payment.qrCodeBase64
        : `data:image/png;base64,${selected.payment.qrCodeBase64}`)
    : generatedQrUrl

  function closeModal() {
    setSelected(null)
    onClose?.()
  }

  return (
    <>
      {showCart ? <section className="pending-pix-cart" aria-labelledby="pending-pix-title">
        <div className="pending-pix-cart__heading">
          <div>
            <span className="panel__eyebrow">Carrinho PIX</span>
            <h3 id="pending-pix-title">PIX para continuar</h3>
            <p>Saia e volte quando quiser. O código permanece disponível até vencer.</p>
          </div>
          <ShoppingCart size={24} />
        </div>

        {visibleItems.length ? (
          <div className="pending-pix-cart__items">
            {visibleItems.map((item) => {
              const expired = isExpired(item.payment, now)
              return (
                <article className="pending-pix-card" key={item.payment.id}>
                  <div>
                    <span>Pedido #{item.order.id} · PIX #{item.payment.id}</span>
                    <strong>{item.order.title}</strong>
                  </div>
                  <div>
                    <strong>{amountLabel(item.payment.finalAmount ?? item.payment.amount)}</strong>
                    <span>{expired ? 'PIX expirado' : 'Aguardando pagamento'}</span>
                  </div>
                  <button
                    className={expired ? 'ghost-button' : 'primary-button primary-button--crimson'}
                    disabled={isRenewing}
                    onClick={() => expired ? void renewPix(item) : setSelected(item)}
                    type="button"
                  >
                    {expired ? <RefreshCw size={15} /> : <QrCode size={15} />}
                    {expired ? 'Gerar novo PIX' : 'Continuar PIX'}
                  </button>
                </article>
              )
            })}
          </div>
        ) : <p className="pending-pix-cart__empty">Nenhum PIX pendente ou abandonado.</p>}
      </section> : null}

      {selected ? (
        <div className="modal-backdrop" onMouseDown={closeModal}>
          <section className="payment-wizard pending-pix-modal" aria-modal="true" onMouseDown={(event) => event.stopPropagation()} role="dialog">
            <button className="confirm-modal__close" onClick={closeModal} type="button" aria-label="Fechar PIX">
              <X size={18} />
            </button>
            <div className="payment-wizard__header">
              <span className="panel__eyebrow">Pedido #{selected.order.id}</span>
              <h2>{selectedExpired ? 'PIX expirado' : 'Continue seu pagamento'}</h2>
            </div>
            <div className="payment-wizard__pix-layout">
              <div className="payment-wizard__qr-frame">
                {qrDataUrl && !selectedExpired ? <img alt="QR Code PIX" src={qrDataUrl} /> : <QrCode size={44} />}
              </div>
              <div className="payment-wizard__pix-copy">
                <strong>{selected.order.title}</strong>
                <label className="payment-wizard__copy-block">
                  <span>Código PIX</span>
                  <textarea readOnly rows={5} value={selected.payment.pixCopyPaste ?? ''} />
                </label>
                <div className="payment-wizard__timer">
                  <span>Validade</span>
                  <strong>{countdownLabel(selectedExpiry, now)}</strong>
                </div>
                {selectedExpired ? (
                  <button className="primary-button primary-button--crimson" disabled={isRenewing} onClick={() => void renewPix(selected)} type="button">
                    {isRenewing ? <Loader2 className="spin-icon" size={16} /> : <RefreshCw size={16} />}
                    Gerar novo PIX neste pedido
                  </button>
                ) : (
                  <button className="primary-button primary-button--crimson" disabled={!selected.payment.pixCopyPaste} onClick={() => void copyCode(selected.payment)} type="button">
                    <Copy size={16} />
                    Copiar código PIX
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
