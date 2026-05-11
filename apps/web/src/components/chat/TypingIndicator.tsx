export function TypingIndicator({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <div className="typing-indicator" aria-live="polite">
      <span />
      <span />
      <span />
      Digitando...
    </div>
  )
}
