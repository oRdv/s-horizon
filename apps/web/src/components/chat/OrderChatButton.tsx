import { MessageCircle } from 'lucide-react'

import type { ServiceOrder } from '@/types/system'

interface OrderChatButtonProps {
  order: ServiceOrder
  onOpen: (order: ServiceOrder) => void
}

export function OrderChatButton({ order, onOpen }: OrderChatButtonProps) {
  if (order.chat_available) {
    return (
      <button className="primary-button primary-button--crimson" onClick={() => onOpen(order)} type="button">
        <MessageCircle size={15} />
        Abrir chat
      </button>
    )
  }

  return (
    <button className="ghost-button" disabled type="button">
      <MessageCircle size={15} />
      {order.payment_status === 'PAID' ? 'Aguardando booster' : 'Chat bloqueado'}
    </button>
  )
}
