import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  CalendarCheck,
  CheckCircle,
  ChevronRight,
  ClipboardList,
  Gamepad2,
  Mail,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Swords,
  Trophy,
  Users,
} from 'lucide-react'

import { AppShell } from '@/components/AppShell'
import { getApiErrorMessage } from '@/services/api/errors'
import { authService } from '@/services/auth'
import { systemService } from '@/services/system'
import { useSessionStore } from '@/store/useSessionStore'
import { useToastStore } from '@/store/useToastStore'
import type { TournamentRegistration, TournamentRosterPlayer } from '@/types/system'
import { maskPhone } from '@/utils/masks'

type TournamentGame = 'lol' | 'wild_rift'

interface TournamentCategory {
  id: string
  game: TournamentGame
  title: string
  shortTitle: string
  format: string
  rosterSize: number
  substituteSlots: number
  serverLabel: string
  description: string
  rules: string[]
}

interface RosterPlayer {
  nick: string
  riotId: string
  role: string
  rank: string
  discord: string
}

interface TournamentForm {
  categoryId: string
  teamName: string
  teamTag: string
  captainName: string
  captainEmail: string
  captainPhone: string
  captainDiscord: string
  server: string
  teamDiscord: string
  howFound: string
  roster: RosterPlayer[]
  notes: string
  acceptedRules: boolean
  acceptedCheckIn: boolean
}

const tournamentCategories: TournamentCategory[] = [
  {
    id: 'lol-5v5',
    game: 'lol',
    title: 'League of Legends 5v5',
    shortTitle: 'LoL 5v5',
    format: 'Summoner’s Rift · Time fechado',
    rosterSize: 5,
    substituteSlots: 2,
    serverLabel: 'Servidor do time',
    description: 'Inscrição para equipe completa com titulares, suplentes e capitão responsável pelo check-in.',
    rules: ['5 titulares obrigatórios', 'Até 2 suplentes', 'Check-in antes da rodada'],
  },
  {
    id: 'lol-1v1',
    game: 'lol',
    title: 'League of Legends 1v1',
    shortTitle: 'LoL 1v1',
    format: 'Howling Abyss · Individual',
    rosterSize: 1,
    substituteSlots: 0,
    serverLabel: 'Servidor da conta',
    description: 'Formato rápido para disputa individual, ideal para evento relâmpago e bracket direto.',
    rules: ['1 jogador por inscrição', 'Riot ID obrigatório', 'Print de resultado quando solicitado'],
  },
  {
    id: 'wild-rift-5v5',
    game: 'wild_rift',
    title: 'Wild Rift 5v5',
    shortTitle: 'WF 5v5',
    format: 'Wild Rift · Time fechado',
    rosterSize: 5,
    substituteSlots: 2,
    serverLabel: 'Região do time',
    description: 'Inscrição mobile para equipe fechada, com Discord do capitão e roster pronto para conferência.',
    rules: ['5 titulares obrigatórios', 'Até 2 suplentes', 'Capitão responde pelo time'],
  },
  {
    id: 'wild-rift-1v1',
    game: 'wild_rift',
    title: 'Wild Rift 1v1',
    shortTitle: 'WF 1v1',
    format: 'Wild Rift · Individual',
    rosterSize: 1,
    substituteSlots: 0,
    serverLabel: 'Região da conta',
    description: 'Categoria individual para disputa rápida no mobile com inscrição simples e confirmação por Discord.',
    rules: ['1 jogador por inscrição', 'Nick e tag obrigatórios', 'Check-in pelo painel'],
  },
]

const roleOptions = ['Top', 'Jungle', 'Mid', 'ADC', 'Suporte', 'Flex', 'Solo']
const rankOptions = [
  'Ferro',
  'Bronze',
  'Prata',
  'Ouro',
  'Platina',
  'Esmeralda',
  'Diamante',
  'Mestre',
  'Grão-Mestre',
  'Desafiante',
]

function createEmptyRoster(size = 7): RosterPlayer[] {
  return Array.from({ length: size }, () => ({
    nick: '',
    riotId: '',
    role: '',
    rank: '',
    discord: '',
  }))
}

function createInitialForm(userName = '', userEmail = '', categoryId = 'lol-5v5'): TournamentForm {
  return {
    categoryId,
    teamName: '',
    teamTag: '',
    captainName: userName,
    captainEmail: userEmail,
    captainPhone: '',
    captainDiscord: '',
    server: 'BR',
    teamDiscord: '',
    howFound: '',
    roster: createEmptyRoster(),
    notes: '',
    acceptedRules: false,
    acceptedCheckIn: false,
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function TournamentsPage() {
  const user = useSessionStore((state) => state.user)
  const addToast = useToastStore((state) => state.addToast)
  const [selectedGame, setSelectedGame] = useState<TournamentGame>('lol')
  const [form, setForm] = useState<TournamentForm>(() => createInitialForm(user?.name, user?.email))
  const [registrations, setRegistrations] = useState<TournamentRegistration[]>([])
  const [isLoadingRegistrations, setIsLoadingRegistrations] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    let active = true

    async function loadRegistrations() {
      try {
        const nextRegistrations = await systemService.getTournamentRegistrations()

        if (active) {
          setRegistrations(nextRegistrations)
        }
      } catch (error: unknown) {
        if (active) {
          addToast({
            tone: 'error',
            title: 'Campeonatos indisponíveis',
            description: getApiErrorMessage(error, 'Não foi possível carregar suas inscrições agora.'),
          })
        }
      } finally {
        if (active) {
          setIsLoadingRegistrations(false)
        }
      }
    }

    void loadRegistrations()

    return () => {
      active = false
    }
  }, [addToast])

  const visibleCategories = tournamentCategories.filter((category) => category.game === selectedGame)
  const selectedCategory =
    tournamentCategories.find((category) => category.id === form.categoryId) ?? tournamentCategories[0]
  const activeRosterSlots = selectedCategory.rosterSize + selectedCategory.substituteSlots

  async function handleLogout() {
    await authService.logout()
  }

  function handleGameChange(game: TournamentGame) {
    const firstCategory = tournamentCategories.find((category) => category.game === game) ?? tournamentCategories[0]

    setSelectedGame(game)
    setForm((currentForm) => ({
      ...currentForm,
      categoryId: firstCategory.id,
      server: game === 'lol' ? 'BR' : 'Américas',
    }))
  }

  function updateField<K extends keyof TournamentForm>(field: K, value: TournamentForm[K]) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function updateRosterPlayer(index: number, field: keyof RosterPlayer, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      roster: currentForm.roster.map((player, playerIndex) =>
        playerIndex === index ? { ...player, [field]: value } : player,
      ),
    }))
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target

    if (name === 'captainPhone') {
      updateField('captainPhone', maskPhone(value))
      return
    }

    updateField(name as keyof TournamentForm, value as TournamentForm[keyof TournamentForm])
  }

  function validateForm() {
    const requiredRoster = form.roster.slice(0, selectedCategory.rosterSize)
    const missingPlayer = requiredRoster.some((player) => !player.nick.trim() || !player.riotId.trim())

    if (!form.teamName.trim()) {
      return 'Informe o nome do time ou nome da inscrição.'
    }

    if (!form.teamTag.trim()) {
      return 'Informe a tag do time. Exemplo: HRZ.'
    }

    if (!form.captainName.trim() || !form.captainEmail.trim() || !form.captainDiscord.trim()) {
      return 'Preencha nome, e-mail e Discord do capitão.'
    }

    if (missingPlayer) {
      return selectedCategory.rosterSize === 1
        ? 'Preencha nick e Riot ID do jogador.'
        : 'Preencha nick e Riot ID de todos os titulares.'
    }

    if (!form.acceptedRules || !form.acceptedCheckIn) {
      return 'Confirme as regras e o compromisso de check-in para finalizar.'
    }

    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationMessage = validateForm()

    if (validationMessage) {
      addToast({
        tone: 'error',
        title: 'Inscrição incompleta',
        description: validationMessage,
      })
      return
    }

    const rosterPayload: TournamentRosterPlayer[] = form.roster
      .slice(0, activeRosterSlots)
      .filter((player, index) => index < selectedCategory.rosterSize || Object.values(player).some((value) => value.trim()))
      .map((player) => ({
        nick: player.nick,
        riot_id: player.riotId,
        role: player.role || null,
        rank: player.rank || null,
        discord: player.discord || null,
      }))

    setIsSubmitting(true)

    try {
      const registration = await systemService.submitTournamentRegistration({
        game: selectedCategory.game,
        category_id: selectedCategory.id,
        team_name: form.teamName,
        team_tag: form.teamTag,
        captain_name: form.captainName,
        captain_email: form.captainEmail,
        captain_phone: form.captainPhone || undefined,
        captain_discord: form.captainDiscord,
        server: form.server,
        team_discord: form.teamDiscord || undefined,
        how_found: form.howFound || undefined,
        roster: rosterPayload,
        notes: form.notes || undefined,
        accepted_rules: form.acceptedRules,
        accepted_check_in: form.acceptedCheckIn,
      })

      setRegistrations((currentRegistrations) => [
        registration,
        ...currentRegistrations.filter((currentRegistration) => currentRegistration.id !== registration.id),
      ])
      setForm({
        ...createInitialForm(user?.name, user?.email, selectedCategory.id),
        server: selectedGame === 'lol' ? 'BR' : 'Américas',
      })

      addToast({
        tone: 'success',
        title: 'Inscrição enviada',
        description: 'Seu time entrou na fila de conferência. A Horizon vai usar o e-mail e o Discord do capitão.',
      })
    } catch (error: unknown) {
      addToast({
        tone: 'error',
        title: 'Inscrição não enviada',
        description: getApiErrorMessage(error, 'Não conseguimos enviar sua inscrição agora. Revise os dados.'),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AppShell userName={user?.name || 'Cliente'} onLogout={handleLogout}>
      <div className="tournaments-page">
        <section className="tournaments-hero panel">
          <div>
            <span className="panel__eyebrow">Área do cliente</span>
            <h1>Campeonatos Horizon</h1>
            <p>
              Monte sua inscrição com time, capitão, Riot ID, Discord, categoria e check-in em um fluxo parecido
              com plataformas de torneio competitivas.
            </p>
          </div>

          <div className="tournament-hero-card panel">
            <Trophy size={28} />
            <strong>LoL e WF primeiro</strong>
            <span>As próximas modalidades entram depois sem bagunçar a inscrição atual.</span>
          </div>
        </section>

        <section className="tournament-tabs" aria-label="Categorias de campeonato">
          <button
            className={`tournament-tab${selectedGame === 'lol' ? ' is-active' : ''}`}
            onClick={() => handleGameChange('lol')}
            type="button"
          >
            <Gamepad2 size={18} />
            League of Legends
          </button>
          <button
            className={`tournament-tab${selectedGame === 'wild_rift' ? ' is-active' : ''}`}
            onClick={() => handleGameChange('wild_rift')}
            type="button"
          >
            <Smartphone size={18} />
            Wild Rift / WF
          </button>
        </section>

        <section className="tournament-category-grid">
          {visibleCategories.map((category) => (
            <button
              className={`tournament-category-card panel${form.categoryId === category.id ? ' is-active' : ''}`}
              key={category.id}
              onClick={() => updateField('categoryId', category.id)}
              type="button"
            >
              <div className="tournament-category-card__top">
                <Swords size={22} />
                <span>{category.shortTitle}</span>
              </div>
              <h2>{category.title}</h2>
              <p>{category.description}</p>
              <strong>{category.format}</strong>
              <ChevronRight size={18} />
            </button>
          ))}
        </section>

        <section className="tournament-layout">
          <form className="tournament-form panel" onSubmit={handleSubmit}>
            <div className="form-panel-title">
              <div>
                <span className="panel__eyebrow">Inscrição</span>
                <h2>{selectedCategory.title}</h2>
              </div>
              <div className="tournament-status-pill">
                <ClipboardList size={15} />
                Conferência pendente
              </div>
            </div>

            <div className="tournament-form-section">
              <div className="tournament-form-section__heading">
                <Users size={18} />
                <h3>Time e capitão</h3>
              </div>

              <div className="form-grid">
                <label className="field-with-helper">
                  <span>Nome do time</span>
                  <input
                    name="teamName"
                    onChange={handleInputChange}
                    placeholder="Ex: Horizon Eclipse"
                    value={form.teamName}
                  />
                  <small>Nome exibido na organização do campeonato.</small>
                </label>

                <label className="field-with-helper">
                  <span>Tag do time</span>
                  <input
                    maxLength={6}
                    name="teamTag"
                    onChange={(event) => updateField('teamTag', event.target.value.toUpperCase())}
                    placeholder="HRZ"
                    value={form.teamTag}
                  />
                  <small>Use uma tag curta, igual aparece em bracket.</small>
                </label>

                <label className="field-with-helper">
                  <span>Nome do capitão</span>
                  <input
                    name="captainName"
                    onChange={handleInputChange}
                    placeholder="Quem responde pelo time"
                    value={form.captainName}
                  />
                  <small>Responsável por check-in, regras e contato.</small>
                </label>

                <label className="field-with-helper">
                  <span>E-mail do capitão</span>
                  <input
                    name="captainEmail"
                    onChange={handleInputChange}
                    placeholder="email@exemplo.com"
                    type="email"
                    value={form.captainEmail}
                  />
                  <small>Campo privado, usado para aviso da organização.</small>
                </label>

                <label className="field-with-helper">
                  <span>Celular do capitão</span>
                  <input
                    inputMode="numeric"
                    name="captainPhone"
                    onChange={handleInputChange}
                    placeholder="(11) 99999-9999"
                    value={form.captainPhone}
                  />
                  <small>Opcional, privado e útil se houver problema no check-in.</small>
                </label>

                <label className="field-with-helper">
                  <span>Discord do capitão</span>
                  <input
                    name="captainDiscord"
                    onChange={handleInputChange}
                    placeholder="usuario#0000 ou @usuario"
                    value={form.captainDiscord}
                  />
                  <small>Principal contato público para organização.</small>
                </label>

                <label className="field-with-helper">
                  <span>{selectedCategory.serverLabel}</span>
                  <select name="server" onChange={handleInputChange} value={form.server}>
                    {selectedGame === 'lol' ? (
                      <>
                        <option value="BR">BR</option>
                        <option value="LAS">LAS</option>
                        <option value="LAN">LAN</option>
                        <option value="NA">NA</option>
                      </>
                    ) : (
                      <>
                        <option value="Américas">Américas</option>
                        <option value="Europa">Europa</option>
                        <option value="Ásia">Ásia</option>
                      </>
                    )}
                  </select>
                  <small>Ajuda a evitar partida com ping impossível.</small>
                </label>

                <label className="field-with-helper">
                  <span>Discord do time</span>
                  <input
                    name="teamDiscord"
                    onChange={handleInputChange}
                    placeholder="Link do servidor ou canal"
                    value={form.teamDiscord}
                  />
                  <small>Opcional para centralizar comunicação do time.</small>
                </label>
              </div>
            </div>

            <div className="tournament-form-section">
              <div className="tournament-form-section__heading">
                <ShieldCheck size={18} />
                <h3>Roster</h3>
              </div>

              <div className="tournament-roster-grid">
                {form.roster.slice(0, activeRosterSlots).map((player, index) => {
                  const isSubstitute = index >= selectedCategory.rosterSize

                  return (
                    <article className="roster-player-card" key={`${selectedCategory.id}-${index}`}>
                      <div className="roster-player-card__title">
                        <strong>{isSubstitute ? `Suplente ${index - selectedCategory.rosterSize + 1}` : `Titular ${index + 1}`}</strong>
                        {index === 0 ? <span>Capitão in-game</span> : null}
                        {isSubstitute ? <span>Opcional</span> : null}
                      </div>

                      <label>
                        Nick in-game
                        <input
                          onChange={(event) => updateRosterPlayer(index, 'nick', event.target.value)}
                          placeholder={selectedGame === 'lol' ? 'Summoner name' : 'Nick no Wild Rift'}
                          value={player.nick}
                        />
                      </label>

                      <label>
                        Riot ID / Tag
                        <input
                          onChange={(event) => updateRosterPlayer(index, 'riotId', event.target.value)}
                          placeholder="Nome#TAG"
                          value={player.riotId}
                        />
                      </label>

                      <label>
                        Função
                        <select onChange={(event) => updateRosterPlayer(index, 'role', event.target.value)} value={player.role}>
                          <option value="">Selecionar</option>
                          {roleOptions.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label>
                        Rank atual
                        <select onChange={(event) => updateRosterPlayer(index, 'rank', event.target.value)} value={player.rank}>
                          <option value="">Selecionar</option>
                          {rankOptions.map((rank) => (
                            <option key={rank} value={rank}>
                              {rank}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field-span-2">
                        Discord do jogador
                        <input
                          onChange={(event) => updateRosterPlayer(index, 'discord', event.target.value)}
                          placeholder="@usuario"
                          value={player.discord}
                        />
                      </label>
                    </article>
                  )
                })}
              </div>
            </div>

            <div className="tournament-form-section">
              <div className="tournament-form-section__heading">
                <CalendarCheck size={18} />
                <h3>Campos extras e regras</h3>
              </div>

              <div className="form-grid">
                <label className="field-with-helper">
                  <span>Como encontrou o campeonato?</span>
                  <input
                    name="howFound"
                    onChange={handleInputChange}
                    placeholder="Discord, amigo, Instagram..."
                    value={form.howFound}
                  />
                  <small>Campo opcional no estilo campo customizado.</small>
                </label>

                <label className="field-with-helper field-span-2">
                  <span>Observações para a organização</span>
                  <textarea
                    name="notes"
                    onChange={handleInputChange}
                    placeholder="Horários, restrições, dúvida sobre regra, troca de jogador..."
                    rows={4}
                    value={form.notes}
                  />
                  <small>Use para qualquer detalhe que a staff precise conferir.</small>
                </label>
              </div>

              <div className="rules-box">
                {selectedCategory.rules.map((rule) => (
                  <span key={rule}>
                    <CheckCircle size={15} />
                    {rule}
                  </span>
                ))}
              </div>

              <label className="check-row">
                <input
                  checked={form.acceptedRules}
                  onChange={(event) => updateField('acceptedRules', event.target.checked)}
                  type="checkbox"
                />
                Li e aceito as regras críticas da categoria selecionada.
              </label>

              <label className="check-row">
                <input
                  checked={form.acceptedCheckIn}
                  onChange={(event) => updateField('acceptedCheckIn', event.target.checked)}
                  type="checkbox"
                />
                Entendo que o capitão precisa fazer check-in antes do início do campeonato.
              </label>
            </div>

            <button className="primary-button primary-button--crimson tournament-submit-button" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Enviando...' : 'Enviar inscrição'}
              <ChevronRight size={18} />
            </button>
          </form>

          <aside className="tournament-side-panel">
            <article className="panel tournament-info-card">
              <Mail size={22} />
              <h3>Depois do envio</h3>
              <p>
                A inscrição fica como pendente. A organização confere roster, categoria e contato antes de liberar
                para chaveamento.
              </p>
            </article>

            <article className="panel tournament-info-card">
              <MessageCircle size={22} />
              <h3>Contato rápido</h3>
              <p>Use o Discord do capitão e do time para evitar WO por falta de resposta no check-in.</p>
            </article>

            <article className="panel tournament-registrations-card">
              <span className="panel__eyebrow">Minhas inscrições</span>
              <h3>Histórico</h3>
              {isLoadingRegistrations ? (
                <p>Carregando suas inscrições...</p>
              ) : registrations.length === 0 ? (
                <p>Nenhuma inscrição enviada ainda.</p>
              ) : (
                <div className="tournament-registration-list">
                  {registrations.map((registration) => (
                    <div className="tournament-registration-item" key={registration.id}>
                      <strong>{registration.team_name}</strong>
                      <span>
                        {registration.category_title} · {registration.server}
                      </span>
                      <small>{formatDateTime(registration.submitted_at)} · {registration.status}</small>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </aside>
        </section>
      </div>
    </AppShell>
  )
}
