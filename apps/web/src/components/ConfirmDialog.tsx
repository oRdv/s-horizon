import { useEffect } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  cancelLabel?: string
  confirmLabel?: string
  description?: string
  isLoading?: boolean
  onClose: () => void
  onConfirm: () => void
  open: boolean
  title: string
  tone?: 'danger' | 'default'
}

export function ConfirmDialog({
  cancelLabel = 'Cancelar',
  confirmLabel = 'Confirmar',
  description,
  isLoading = false,
  onClose,
  onConfirm,
  open,
  title,
  tone = 'default',
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isLoading) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isLoading, onClose, open])

  if (!open) {
    return null
  }

  return (
    <div className="modal-backdrop" onMouseDown={isLoading ? undefined : onClose}>
      <section
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className={`confirm-modal confirm-modal--${tone}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Fechar modal"
          className="confirm-modal__close"
          disabled={isLoading}
          onClick={onClose}
          type="button"
        >
          <X size={18} />
        </button>

        <div className="confirm-modal__icon" aria-hidden="true">
          <AlertTriangle size={24} />
        </div>

        <div className="confirm-modal__content">
          <span className="panel__eyebrow">Confirmação necessária</span>
          <h2 id="confirm-dialog-title">{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>

        <div className="confirm-modal__actions">
          <button className="ghost-button" disabled={isLoading} onClick={onClose} type="button">
            {cancelLabel}
          </button>
          <button
            className={`primary-button${tone === 'danger' ? ' confirm-modal__danger-action' : ''}`}
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            {isLoading ? 'Processando...' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}
