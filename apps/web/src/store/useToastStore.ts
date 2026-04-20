import { create } from 'zustand'

export type ToastTone = 'error' | 'success' | 'info'

export interface ToastMessage {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

interface ToastState {
  toasts: ToastMessage[]
  addToast: (toast: Omit<ToastMessage, 'id'> & { durationMs?: number }) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  addToast: ({ durationMs = 5200, ...toast }) => {
    const id =
      globalThis.crypto?.randomUUID?.() ?? `toast-${Date.now()}-${Math.random()}`

    set((state) => ({
      toasts: [...state.toasts, { id, ...toast }],
    }))

    window.setTimeout(() => {
      get().removeToast(id)
    }, durationMs)
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    }))
  },
}))
