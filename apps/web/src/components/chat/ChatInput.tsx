import { Loader2, Send } from 'lucide-react'
import type { KeyboardEvent } from 'react'

interface ChatInputProps {
  disabled?: boolean
  isSending?: boolean
  value: string
  onChange: (value: string) => void
  onSend: () => void
}

export function ChatInput({ disabled, isSending, value, onChange, onSend }: ChatInputProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return

    event.preventDefault()
    onSend()
  }

  return (
    <div className="chat-input">
      <textarea
        disabled={disabled || isSending}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={disabled ? 'Conversa indisponível' : 'Escreva sua mensagem'}
        rows={2}
        value={value}
      />
      <button
        aria-label="Enviar mensagem"
        className="chat-input__send"
        disabled={disabled || isSending || !value.trim()}
        onClick={onSend}
        type="button"
      >
        {isSending ? <Loader2 className="spin-icon" size={18} /> : <Send size={18} />}
      </button>
    </div>
  )
}
