import { ShieldCheck, Wifi } from 'lucide-react'

import type { OrderConversation, ServiceOrder } from '@/types/system'

const rankLabels: Record<string, string> = {
  iron: 'Ferro',
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
  platinum: 'Platina',
  emerald: 'Esmeralda',
  diamond: 'Diamante',
  master: 'Mestre',
  grandmaster: 'Grão-mestre',
  challenger: 'Desafiante',
}

function rankKey(value?: unknown) {
  return typeof value === 'string' ? value.toLowerCase() : ''
}

function rankLabel(tier?: unknown, division?: unknown) {
  const key = rankKey(tier)
  const label = rankLabels[key] ?? (typeof tier === 'string' ? tier : 'Elo')
  const div = typeof division === 'string' ? division : ''

  return [label, div].filter(Boolean).join(' ')
}

function RankBadge({ division, tier }: { division?: unknown; tier?: unknown }) {
  const key = rankKey(tier)
  const label = rankLabel(tier, division)
  const src = key ? `/ranks/${key}.png` : ''

  return (
    <div className="chat-rank-badge">
      {src ? (
        <img alt="" onError={(event) => { event.currentTarget.style.display = 'none' }} src={src} />
      ) : null}
      <span>{label.slice(0, 2).toUpperCase()}</span>
      <strong>{label}</strong>
    </div>
  )
}

export function ChatConversationHeader({
  conversation,
  order,
}: {
  conversation?: OrderConversation | null
  order: ServiceOrder
}) {
  const metadata = order.metadata ?? {}

  return (
    <header className="chat-header">
      <div className="chat-header__title">
        <span className="panel__eyebrow">Pedido #{order.id}</span>
        <h2>Chat do boost</h2>
        <p>{conversation?.booster?.name ?? order.booster?.name ?? 'Booster designado'}</p>
      </div>
      <div className="chat-header__badges">
        <RankBadge division={metadata.current_division} tier={metadata.current_tier} />
        <span className="chat-rank-arrow">→</span>
        <RankBadge division={metadata.target_division} tier={metadata.target_tier} />
      </div>
      <div className="chat-header__status">
        <span><Wifi size={14} /> Atualização automática</span>
        <span><ShieldCheck size={14} /> Conversa segura</span>
      </div>
    </header>
  )
}
