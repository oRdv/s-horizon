import { useEffect, useRef } from 'react'

import { ChatMessageBubble } from '@/components/chat/ChatMessageBubble'
import { TypingIndicator } from '@/components/chat/TypingIndicator'
import type { AuthUser } from '@/types/auth'
import type { OrderChatMessage } from '@/types/system'

export function ChatMessageList({
  canPin,
  currentUser,
  onPinMessage,
  pinnedMessageId,
  isLoading,
  messages,
  typing,
}: {
  currentUser?: AuthUser | null
  canPin?: boolean
  isLoading?: boolean
  messages: OrderChatMessage[]
  onPinMessage?: (message: OrderChatMessage) => void
  pinnedMessageId?: number | null
  typing?: boolean
}) {
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    list.scrollTo({
      top: list.scrollHeight,
      behavior: messages.length > 1 ? 'smooth' : 'auto',
    })
  }, [messages.length])

  return (
    <div className="chat-message-list" ref={listRef}>
      {isLoading ? (
        <div className="chat-message-list__state">Carregando conversa...</div>
      ) : messages.length ? (
        messages.map((message) => (
          <ChatMessageBubble
            canPin={canPin}
            currentUser={currentUser}
            isPinned={message.id === pinnedMessageId}
            key={message.id}
            message={message}
            onPin={onPinMessage}
          />
        ))
      ) : (
        <div className="chat-message-list__state">Conversa liberada. Envie a primeira mensagem.</div>
      )}
      <TypingIndicator visible={Boolean(typing)} />
    </div>
  )
}
