import { useEffect, useState, type ComponentType } from 'react'
import {
  CalendarCheck,
  ClipboardList,
  Eye,
  Gamepad2,
  Mail,
  ShieldCheck,
  Smartphone,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { AppShell } from '@/components/AppShell'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { AdminTournamentSummary, TournamentRegistration } from '@/types/system'

type TournamentGameFilter = 'all' | 'lol' | 'wild_rift'

const emptySummary: AdminTournamentSummary = {
  total: 0,
  teams: 0,
  pending: 0,
  lol: 0,
  wild_rift: 0,
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return 'Sem data'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatGame(game: TournamentRegistration['game']) {
  return game === 'lol' ? 'League of Legends' : 'Wild Rift'
}

function formatStatus(status: string) {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    checked_in: 'Check-in feito',
  }

  return labels[status] ?? status
}

export function AdminTournamentsPage() {
  const navigate = useNavigate()
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [summary, setSummary] = useState<AdminTournamentSummary>(emptySummary)
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([])
  const [selectedRegistration, setSelectedRegistration] = useState<TournamentRegistration | null>(null)
  const [gameFilter, setGameFilter] = useState<TournamentGameFilter>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  useEffect(() => {
    let active = true

    async function loadRegistrations() {
      setIsLoading(true)

      try {
        const response = await systemService.getAdminTournamentRegistrations({
          game: gameFilter === 'all' ? undefined : gameFilter,
        })

        if (active) {
          setSummary(response.summary)
          setRegistrations(response.registrations.data)
        }
      } catch (error: unknown) {
        if (active) {
          addToast({
            tone: 'error',
            title: 'Campeonatos indisponíveis',
            description: getApiErrorMessage(error, 'Não foi possível carregar as inscrições de campeonatos.'),
          })
        }
      } finally {
        if (active) {
          setIsLoading(false)
        }
      }
    }

    void loadRegistrations()

    return () => {
      active = false
    }
  }, [addToast, gameFilter])

  async function handleLogout() {
    await authService.logout()
    navigate('/login', { replace: true })
  }

  async function handleOpenDetails(registration: TournamentRegistration) {
    setSelectedRegistration(registration)
    setIsLoadingDetails(true)

    try {
      const fullRegistration = await systemService.getAdminTournamentRegistration(registration.id)

      setSelectedRegistration(fullRegistration)
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Detalhes indisponíveis',
        description: getApiErrorMessage(error, 'Não foi possível carregar os dados completos desse time.'),
      })
    } finally {
      setIsLoadingDetails(false)
    }
  }

  return (
    <AppShell onLogout={handleLogout} userName={user?.name ?? 'Admin'}>
      <div className="admin-tournaments-page">
        <section className="system-hero panel">
          <div>
            <span className="panel__eyebrow">Administração</span>
            <h1>Campeonatos e times inscritos</h1>
          </div>

          <div className="tournament-admin-filter" aria-label="Filtrar campeonatos">
            <button className={gameFilter === 'all' ? 'is-active' : ''} onClick={() => setGameFilter('all')} type="button">
              Todos
            </button>
            <button className={gameFilter === 'lol' ? 'is-active' : ''} onClick={() => setGameFilter('lol')} type="button">
              LoL
            </button>
            <button
              className={gameFilter === 'wild_rift' ? 'is-active' : ''}
              onClick={() => setGameFilter('wild_rift')}
              type="button"
            >
              WF
            </button>
          </div>
        </section>

        <section className="system-card-grid">
          <SummaryCard icon={Trophy} label="Inscrições" value={summary.total} />
          <SummaryCard icon={Users} label="Times" value={summary.teams} />
          <SummaryCard icon={ClipboardList} label="Pendentes" value={summary.pending} />
          <SummaryCard icon={Gamepad2} label="League of Legends" value={summary.lol} />
          <SummaryCard icon={Smartphone} label="Wild Rift" value={summary.wild_rift} />
        </section>

        <section className="management-panel panel">
          <div className="form-panel-title">
            <div>
              <span className="panel__eyebrow">Times cadastrados</span>
              <h2>Inscrições recebidas</h2>
            </div>
          </div>

          {isLoading ? (
            <p>Carregando inscrições...</p>
          ) : registrations.length === 0 ? (
            <p>Nenhum time inscrito ainda.</p>
          ) : (
            <div className="admin-tournament-list">
              {registrations.map((registration) => (
                <button
                  className="admin-tournament-row"
                  key={registration.id}
                  onClick={() => void handleOpenDetails(registration)}
                  type="button"
                >
                  <div>
                    <strong>{registration.team_name}</strong>
                    <span>
                      {registration.team_tag} · {registration.category_title} · {registration.server}
                    </span>
                  </div>
                  <div>
                    <strong>{registration.user?.name ?? registration.captain_name}</strong>
                    <span>{registration.user?.email ?? registration.captain_email}</span>
                  </div>
                  <div>
                    <strong>{formatStatus(registration.status)}</strong>
                    <span>{formatDateTime(registration.submitted_at)}</span>
                  </div>
                  <span className="admin-tournament-row__action">
                    <Eye size={16} />
                    Ver dados
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {selectedRegistration ? (
          <TournamentDetailsModal
            isLoading={isLoadingDetails}
            onClose={() => setSelectedRegistration(null)}
            registration={selectedRegistration}
          />
        ) : null}
      </div>
    </AppShell>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ size?: number }>
  label: string
  value: number | string
}) {
  return (
    <article className="summary-card panel">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

function TournamentDetailsModal({
  isLoading,
  onClose,
  registration,
}: {
  isLoading: boolean
  onClose: () => void
  registration: TournamentRegistration
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        aria-labelledby="tournament-details-title"
        aria-modal="true"
        className="tournament-detail-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Fechar detalhes" className="confirm-modal__close" onClick={onClose} type="button">
          <X size={18} />
        </button>

        <div className="tournament-detail-modal__header">
          <span className="panel__eyebrow">{formatGame(registration.game)}</span>
          <h2 id="tournament-details-title">{registration.team_name}</h2>
          <p>
            {registration.category_title} · {registration.team_tag} · {formatStatus(registration.status)}
          </p>
        </div>

        {isLoading ? <p>Atualizando dados completos...</p> : null}

        <div className="tournament-detail-grid">
          <article>
            <Users size={18} />
            <span>Conta do cliente</span>
            <strong>{registration.user?.name ?? 'Cliente não carregado'}</strong>
            <small>ID #{registration.user?.id ?? registration.user_id}</small>
            <small>{registration.user?.email ?? registration.captain_email}</small>
            <small>{registration.user?.email_verified_at ? 'Email verificado' : 'Email não verificado'}</small>
          </article>

          <article>
            <Mail size={18} />
            <span>Capitão</span>
            <strong>{registration.captain_name}</strong>
            <small>{registration.captain_email}</small>
            <small>{registration.captain_phone || 'Sem celular'}</small>
            <small>{registration.captain_discord}</small>
          </article>

          <article>
            <CalendarCheck size={18} />
            <span>Inscrição</span>
            <strong>{registration.server}</strong>
            <small>{formatDateTime(registration.submitted_at)}</small>
            <small>{registration.team_discord || 'Sem Discord do time'}</small>
            <small>{registration.how_found || 'Origem não informada'}</small>
          </article>

          <article>
            <ShieldCheck size={18} />
            <span>Regras</span>
            <strong>{registration.accepted_rules ? 'Aceitas' : 'Pendentes'}</strong>
            <small>{registration.accepted_check_in ? 'Check-in confirmado' : 'Check-in não confirmado'}</small>
            <small>{registration.notes || 'Sem observações'}</small>
          </article>
        </div>

        <div className="tournament-roster-table">
          <div className="tournament-roster-table__head">
            <span>Jogador</span>
            <span>Riot ID</span>
            <span>Função</span>
            <span>Rank</span>
            <span>Discord</span>
          </div>
          {registration.roster.map((player, index) => (
            <div className="tournament-roster-table__row" key={`${player.riot_id}-${index}`}>
              <strong>{player.nick}</strong>
              <span>{player.riot_id}</span>
              <span>{player.role || '-'}</span>
              <span>{player.rank || '-'}</span>
              <span>{player.discord || '-'}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
