import { useEffect, useState } from 'react'
import { Loader2, Pin, PinOff, X } from 'lucide-react'

import { ChatConversationHeader } from '@/components/chat/ChatConversationHeader'
import { ChatInput } from '@/components/chat/ChatInput'
import { ChatMessageList } from '@/components/chat/ChatMessageList'
import { getApiErrorMessage } from '@/services/api/errors'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { OrderChatMessage, OrderConversation, ServiceOrder } from '@/types/system'

interface ChatModalProps {
  order: ServiceOrder
  onClose: () => void
}

export function ChatModal({ order, onClose }: ChatModalProps) {
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [conversation, setConversation] = useState<OrderConversation | null>(null)
  const [messages, setMessages] = useState<OrderChatMessage[]>([])
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const canPin = user?.role === 'booster' || user?.role === 'master_admin' || user?.role === 'staff'
  const pinnedMessage = conversation?.pinnedMessage ?? conversation?.pinned_message ?? null
  const pinnedMessageId = conversation?.pinnedMessageId ?? conversation?.pinned_message_id ?? pinnedMessage?.id ?? null

  useEffect(() => {
    let active = true

    async function loadConversation() {
      try {
        const response = await systemService.getOrderConversation(order.id)

        if (!active) return

        if (!response.available || !response.conversation) {
          setConversation(null)
          setMessages([])
          setError(response.message ?? 'O chat ainda não está liberado para este pedido.')
          return
        }

        setConversation(response.conversation)
        setMessages(response.messages)
        setError(null)
        await systemService.markConversationRead(response.conversation.id)
      } catch (requestError: unknown) {
        if (active) {
          setError(getApiErrorMessage(requestError, 'Não foi possível carregar o chat.'))
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadConversation()

    return () => {
      active = false
    }
  }, [order.id])

  useEffect(() => {
    if (!conversation) return undefined

    let active = true
    const conversationId = conversation.id

    async function pollMessages() {
      try {
        const nextMessages = await systemService.getConversationMessages(conversationId)
        if (!active) return

        setMessages(nextMessages)
        await systemService.markConversationRead(conversationId)
      } catch {
        if (active) {
          setError('Conexão instável. Tentando atualizar a conversa...')
        }
      }
    }

    const interval = window.setInterval(() => void pollMessages(), 2500)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [conversation])

  async function handleSend() {
    const text = body.trim()
    if (!text || !conversation || isSending) return

    setIsSending(true)
    try {
      const message = await systemService.sendConversationMessage(conversation.id, text)
      setMessages((current) => [...current, message])
      setBody('')
      setError(null)
    } catch (requestError: unknown) {
      addToast({
        tone: 'error',
        title: 'Mensagem não enviada',
        description: getApiErrorMessage(requestError, 'Tente novamente em alguns segundos.'),
      })
    } finally {
      setIsSending(false)
    }
  }

  async function handlePinMessage(message: OrderChatMessage) {
    if (!conversation || !canPin) return

    const nextPinnedId = pinnedMessageId === message.id ? null : message.id

    try {
      const nextConversation = await systemService.pinConversationMessage(conversation.id, nextPinnedId)
      setConversation(nextConversation)
    } catch (requestError: unknown) {
      addToast({
        tone: 'error',
        title: 'Não foi possível fixar',
        description: getApiErrorMessage(requestError, 'Apenas o booster pode fixar mensagens.'),
      })
    }
  }

  return (
    <div className="modal-backdrop chat-modal-backdrop" onMouseDown={onClose}>
      <section className="chat-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <button className="confirm-modal__close" type="button" onClick={onClose} aria-label="Fechar chat">
          <X size={18} />
        </button>
        <ChatConversationHeader conversation={conversation} order={order} />
        {pinnedMessage ? (
          <div className="chat-pinned-message">
            <Pin size={16} />
            <div>
              <span>Mensagem fixada</span>
              <strong>{pinnedMessage.sender?.name ?? 'Equipe Horizon'}</strong>
              <p>{pinnedMessage.message ?? pinnedMessage.body}</p>
            </div>
            {canPin ? (
              <button aria-label="Desfixar mensagem" onClick={() => void handlePinMessage(pinnedMessage)} type="button">
                <PinOff size={16} />
              </button>
            ) : null}
          </div>
        ) : null}
        {error ? <div className="chat-alert">{error}</div> : null}
        {isLoading ? (
          <div className="chat-loading">
            <Loader2 className="spin-icon" size={34} />
            Carregando chat...
          </div>
        ) : (
          <>
            <ChatMessageList
              canPin={canPin}
              currentUser={user}
              messages={messages}
              onPinMessage={(message) => void handlePinMessage(message)}
              pinnedMessageId={pinnedMessageId}
            />
            <ChatInput disabled={!conversation || conversation.status !== 'ACTIVE'} isSending={isSending} onChange={setBody} onSend={() => void handleSend()} value={body} />
          </>
        )}
      </section>
    </div>
  )
}
