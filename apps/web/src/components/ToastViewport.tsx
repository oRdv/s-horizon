import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from 'lucide-react'

import { useToastStore, type ToastTone } from '@/store/useToastStore'

const toastIcons: Record<ToastTone, LucideIcon> = {
  error: AlertTriangle,
  success: CheckCircle2,
  info: Info,
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts)
  const removeToast = useToastStore((state) => state.removeToast)

  return (
    <div className="toast-viewport" aria-live="polite" aria-relevant="additions">
      {toasts.map((toast) => {
        const Icon = toastIcons[toast.tone]

        return (
          <article className={`toast toast--${toast.tone}`} key={toast.id}>
            <Icon size={18} strokeWidth={2} />
            <div className="toast__content">
              <strong>{toast.title}</strong>
              {toast.description ? <p>{toast.description}</p> : null}
            </div>
            <button
              aria-label="Fechar aviso"
              onClick={() => removeToast(toast.id)}
              type="button"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </article>
        )
      })}
    </div>
  )
}
