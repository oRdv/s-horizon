import axios from 'axios';
import https from 'node:https';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
});
export class LcuMonitor {
    async snapshot() {
        const lockfile = await this.findLockfile();
        const capturedAt = new Date().toISOString();
        if (!lockfile) {
            return {
                clientOpen: false,
                status: 'OFFLINE',
                gameflowPhase: null,
                riotAccount: null,
                currentGame: null,
                rankedProgress: null,
                recentMatches: [],
                capturedAt,
                error: null,
            };
        }
        try {
            const [summoner, gameflow, champSelect, rankedStats] = await Promise.all([
                this.requestLcu(lockfile, '/lol-summoner/v1/current-summoner').catch(() => null),
                this.requestLcu(lockfile, '/lol-gameflow/v1/session').catch(() => null),
                this.requestLcu(lockfile, '/lol-champ-select/v1/session').catch(() => null),
                this.requestLcu(lockfile, '/lol-ranked/v1/current-ranked-stats').catch(() => null),
            ]);
            const phase = readString(gameflow?.phase) ?? 'CLIENT_OPEN';
            const status = this.mapGameflowToStatus(phase);
            const currentGame = this.extractCurrentGame(gameflow, champSelect);
            return {
                clientOpen: true,
                status,
                gameflowPhase: phase,
                riotAccount: summoner
                    ? {
                        gameName: readString(summoner.gameName) ?? readString(summoner.displayName),
                        tagLine: readString(summoner.tagLine),
                        summonerName: readString(summoner.displayName) ?? readString(summoner.internalName),
                        puuid: readString(summoner.puuid),
                        region: process.env.RIOT_REGION ?? 'BR1',
                    }
                    : null,
                currentGame,
                rankedProgress: this.extractRankedProgress(rankedStats),
                recentMatches: [],
                capturedAt,
                error: null,
            };
        }
        catch (error) {
            return {
                clientOpen: true,
                status: 'CLIENT_OPEN',
                gameflowPhase: null,
                riotAccount: null,
                currentGame: null,
                rankedProgress: null,
                recentMatches: [],
                capturedAt,
                error: toErrorMessage(error),
            };
        }
    }
    async findLockfile() {
        const explicitPath = process.env.LEAGUE_LOCKFILE_PATH;
        const candidatePaths = [
            explicitPath,
            path.join('C:\\Riot Games\\League of Legends', 'lockfile'),
            path.join(process.env.PROGRAMFILES ?? '', 'Riot Games', 'League of Legends', 'lockfile'),
            path.join(process.env['PROGRAMFILES(X86)'] ?? '', 'Riot Games', 'League of Legends', 'lockfile'),
            path.join(process.env.LOCALAPPDATA ?? '', 'Riot Games', 'League of Legends', 'lockfile'),
            path.join(process.env.LOCALAPPDATA ?? '', 'Riot Games', 'Riot Client', 'Config', 'lockfile'),
        ].filter(Boolean);
        for (const candidatePath of candidatePaths) {
            try {
                await access(candidatePath);
                const content = await readFile(candidatePath, 'utf8');
                const [, , port, password, protocol] = content.trim().split(':');
                if (port && password) {
                    return { port, password, protocol: protocol || 'https' };
                }
            }
            catch {
                continue;
            }
        }
        return null;
    }
    async requestLcu(lockfile, endpoint) {
        const response = await axios.get(`${lockfile.protocol}://127.0.0.1:${lockfile.port}${endpoint}`, {
            auth: {
                username: 'riot',
                password: lockfile.password,
            },
            httpsAgent,
            timeout: 2500,
        });
        return response.data;
    }
    mapGameflowToStatus(phase) {
        switch (phase) {
            case 'Lobby':
            case 'Matchmaking':
            case 'ReadyCheck':
                return 'IN_LOBBY';
            case 'ChampSelect':
                return 'IN_CHAMP_SELECT';
            case 'InProgress':
                return 'IN_GAME';
            case 'EndOfGame':
            case 'PreEndOfGame':
            case 'WaitingForStats':
                return 'GAME_ENDED';
            default:
                return 'CLIENT_OPEN';
        }
    }
    extractCurrentGame(gameflow, champSelect) {
        const gameData = readRecord(gameflow?.gameData);
        const queue = readRecord(gameData?.queue);
        const session = readRecord(gameflow?.gameClient);
        const championId = this.extractChampionId(champSelect);
        if (!gameData && !session && !championId) {
            return null;
        }
        return {
            gameId: readString(gameData?.gameId ?? gameflow?.gameId),
            queueId: readNumber(queue?.id ?? gameData?.queueId),
            championId,
            startedAt: readString(session?.running ? new Date().toISOString() : null),
        };
    }
    extractChampionId(champSelect) {
        const localPlayerCellId = readNumber(champSelect?.localPlayerCellId);
        const myTeam = readRecordArray(champSelect?.myTeam) ?? [];
        const player = myTeam.find((item) => readNumber(item.cellId) === localPlayerCellId) ?? myTeam[0];
        return readNumber(player?.championId);
    }
    extractRankedProgress(rankedStats) {
        const queues = rankedStats?.queues ?? rankedStats?.queueMap;
        const queueList = Array.isArray(queues) ? queues.filter(isRecord) : null;
        const queueMap = readRecord(queues);
        const soloQueue = queueList
            ? queueList.find((queue) => readString(queue.queueType) === 'RANKED_SOLO_5x5') ?? queueList[0]
            : readRecord(queueMap?.RANKED_SOLO_5x5) ?? readRecord(queueMap?.RANKED_FLEX_SR);
        if (!soloQueue) {
            return null;
        }
        return {
            tier: readString(soloQueue.tier),
            division: readString(soloQueue.division ?? soloQueue.rank),
            leaguePoints: readNumber(soloQueue.leaguePoints),
            queueType: readString(soloQueue.queueType) ?? 'RANKED_SOLO_5x5',
            wins: readNumber(soloQueue.wins),
            losses: readNumber(soloQueue.losses),
        };
    }
}
function readString(value) {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}
function readNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function readRecord(value) {
    return isRecord(value) ? value : null;
}
function readRecordArray(value) {
    return Array.isArray(value) ? value.filter(isRecord) : null;
}
function toErrorMessage(error) {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Falha ao ler o League Client local.';
}
//# sourceMappingURL=lcuMonitor.js.map