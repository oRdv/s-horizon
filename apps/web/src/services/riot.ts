export interface LolChampionOption {
  id: string
  key: string
  name: string
}

interface RiotChampionPayload {
  data: Record<
    string,
    {
      id: string
      key: string
      name: string
    }
  >
}

let championCache: LolChampionOption[] | null = null
let championRequest: Promise<LolChampionOption[]> | null = null

async function fetchLatestDataDragonVersion() {
  const response = await fetch('https://ddragon.leagueoflegends.com/api/versions.json')

  if (!response.ok) {
    throw new Error('Nao foi possivel carregar a versao do Data Dragon.')
  }

  const versions = (await response.json()) as string[]

  if (!versions.length) {
    throw new Error('Nenhuma versao do Data Dragon foi encontrada.')
  }

  return versions[0]
}

async function fetchChampionPayload(version: string) {
  const response = await fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/pt_BR/champion.json`)

  if (!response.ok) {
    throw new Error('Nao foi possivel carregar a lista oficial de campeoes.')
  }

  return (await response.json()) as RiotChampionPayload
}

export async function getLolChampionOptions() {
  if (championCache) {
    return championCache
  }

  if (!championRequest) {
    championRequest = (async () => {
      const version = await fetchLatestDataDragonVersion()
      const payload = await fetchChampionPayload(version)

      const champions = Object.values(payload.data)
        .map((champion) => ({
          id: champion.id,
          key: champion.key,
          name: champion.name,
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

      championCache = champions

      return champions
    })()
  }

  try {
    return await championRequest
  } finally {
    championRequest = null
  }
}
