import { Pin } from 'lucide-react'

import type { AuthUser } from '@/types/auth'
import type { OrderChatMessage } from '@/types/system'

function messageText(message: OrderChatMessage) {
  return message.message ?? message.body
}

function messageDate(message: OrderChatMessage) {
  return message.createdAt ?? message.created_at
}

function formatMessageTime(value?: string) {
  if (!value) return ''

  const date = new Date(value)
  const now = new Date()
  const sameDay =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  return new Intl.DateTimeFormat('pt-BR', {
    day: sameDay ? undefined : '2-digit',
    month: sameDay ? undefined : '2-digit',
    year: sameDay ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function initials(name?: string | null) {
  return (name ?? 'HB')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'HB'
}

export function ChatMessageBubble({
  canPin,
  currentUser,
  isPinned,
  message,
  onPin,
}: {
  canPin?: boolean
  currentUser?: AuthUser | null
  isPinned?: boolean
  message: OrderChatMessage
  onPin?: (message: OrderChatMessage) => void
}) {
  const isOwn = message.sender_id === currentUser?.id || message.senderId === currentUser?.id
  const sender = message.sender
  const read = Boolean(message.read_at ?? message.readAt ?? message.is_read ?? message.isRead)

  return (
    <article className={`chat-message${isOwn ? ' is-own' : ''}${isPinned ? ' is-pinned' : ''}`}>
      {!isOwn ? (
        <div className="chat-message__avatar">
          {sender?.profile_photo_path ? <img alt="" src={sender.profile_photo_path} /> : initials(sender?.name)}
        </div>
      ) : null}
      <div className="chat-message__body">
        <div className="chat-message__meta">
          <strong>{isOwn ? 'Você' : sender?.name ?? 'Equipe Horizon'}</strong>
          <span>{formatMessageTime(messageDate(message))}</span>
        </div>
        <p>{messageText(message)}</p>
        {isOwn ? <small>{read ? 'Visualizada' : 'Enviada'}</small> : null}
        {canPin ? (
          <button className="chat-message__pin" onClick={() => onPin?.(message)} type="button">
            <Pin size={13} />
            {isPinned ? 'Fixada' : 'Fixar'}
          </button>
        ) : null}
      </div>
    </article>
  )
}
