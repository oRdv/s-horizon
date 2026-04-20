import type { FormEvent } from 'react'

import type { DesktopSession } from '../../shared/types'

interface SessionFormProps {
  apiBaseUrl: string
  accessToken: string
  refreshToken: string
  isSaving: boolean
  onApiBaseUrlChange: (value: string) => void
  onAccessTokenChange: (value: string) => void
  onRefreshTokenChange: (value: string) => void
  onSave: (session: DesktopSession) => Promise<void>
  onClear: () => Promise<void>
}

export function SessionForm({
  apiBaseUrl,
  accessToken,
  refreshToken,
  isSaving,
  onApiBaseUrlChange,
  onAccessTokenChange,
  onRefreshTokenChange,
  onSave,
  onClear,
}: SessionFormProps) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!apiBaseUrl || !accessToken) {
      return
    }

    await onSave({
      apiBaseUrl,
      accessToken,
      refreshToken: refreshToken || undefined,
    })
  }

  return (
    <form className="session-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>URL do backend</span>
        <input
          onChange={(event) => onApiBaseUrlChange(event.target.value)}
          placeholder="http://127.0.0.1:8000"
          value={apiBaseUrl}
        />
      </label>

      <label className="field">
        <span>Access token</span>
        <textarea
          onChange={(event) => onAccessTokenChange(event.target.value)}
          placeholder="Cole aqui o access token JWT"
          rows={4}
          value={accessToken}
        />
      </label>

      <label className="field">
        <span>Refresh token (opcional)</span>
        <textarea
          onChange={(event) => onRefreshTokenChange(event.target.value)}
          placeholder="Use para manter a sessão ativa automaticamente"
          rows={4}
          value={refreshToken}
        />
      </label>

      <div className="session-form__actions">
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? 'Salvando...' : 'Salvar sessão'}
        </button>

        <button className="ghost-button" onClick={() => void onClear()} type="button">
          Limpar
        </button>
      </div>
    </form>
  )
}
