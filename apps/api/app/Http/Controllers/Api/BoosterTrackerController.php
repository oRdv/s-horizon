<?php

namespace App\Http\Controllers\Api;

use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\BoosterRiotAccount;
use App\Models\BoosterTrackerSession;
use App\Models\ServiceOrder;
use App\Models\TrackedMatch;
use App\Models\User;
use App\Services\Riot\RiotApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BoosterTrackerController extends Controller
{
    private const STATUSES = [
        'ONLINE',
        'OFFLINE',
        'CLIENT_OPEN',
        'IN_LOBBY',
        'IN_CHAMP_SELECT',
        'IN_GAME',
        'GAME_ENDED',
    ];

    public function heartbeat(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->hasRole(UserRole::Booster)) {
            return response()->json(['message' => 'Somente boosters podem enviar acompanhamento.'], 403);
        }

        $validated = $request->validate([
            'orderId' => ['required', 'integer', 'exists:service_orders,id'],
            'status' => ['required', Rule::in(self::STATUSES)],
            'riotAccount' => ['nullable', 'array'],
            'riotAccount.gameName' => ['nullable', 'string', 'max:120'],
            'riotAccount.tagLine' => ['nullable', 'string', 'max:16'],
            'riotAccount.summonerName' => ['nullable', 'string', 'max:120'],
            'riotAccount.puuid' => ['nullable', 'string', 'max:120'],
            'riotAccount.region' => ['nullable', 'string', 'max:12'],
            'currentGame' => ['nullable', 'array'],
            'currentGame.gameId' => ['nullable', 'string', 'max:120'],
            'currentGame.queueId' => ['nullable', 'integer'],
            'currentGame.championId' => ['nullable', 'integer'],
            'currentGame.startedAt' => ['nullable', 'date'],
            'rankedProgress' => ['nullable', 'array'],
            'rankedProgress.tier' => ['nullable', 'string', 'max:32'],
            'rankedProgress.division' => ['nullable', 'string', 'max:8'],
            'rankedProgress.leaguePoints' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'rankedProgress.queueType' => ['nullable', 'string', 'max:64'],
            'rankedProgress.wins' => ['nullable', 'integer', 'min:0'],
            'rankedProgress.losses' => ['nullable', 'integer', 'min:0'],
        ]);

        $order = ServiceOrder::query()->findOrFail($validated['orderId']);

        if ((int) $order->booster_id !== (int) $user->getKey()) {
            return response()->json(['message' => 'Esse pedido nao esta atribuido a voce.'], 403);
        }

        if (! in_array($order->status, [
            ServiceOrderStatus::BoosterAssigned->value,
            ServiceOrderStatus::Assigned->value,
            ServiceOrderStatus::InProgress->value,
            ServiceOrderStatus::Completed->value,
        ], true)) {
            throw ValidationException::withMessages([
                'orderId' => 'O acompanhamento so fica disponivel depois que o booster pega o pedido.',
            ]);
        }

        $riotAccount = $validated['riotAccount'] ?? [];
        $currentGame = $validated['currentGame'] ?? [];
        $rankedProgress = $validated['rankedProgress'] ?? null;
        $now = now();
        $previousSession = BoosterTrackerSession::query()
            ->where('booster_id', $user->getKey())
            ->where('service_order_id', $order->getKey())
            ->first();
        $lpDelta = $this->calculateLpDelta($previousSession?->ranked_snapshot, $rankedProgress);
        $progressPercent = $this->calculateProgressPercent($order, $rankedProgress);

        $session = BoosterTrackerSession::query()->updateOrCreate(
            [
                'booster_id' => $user->getKey(),
                'service_order_id' => $order->getKey(),
            ],
            [
                'status' => $validated['status'],
                'riot_puuid' => $riotAccount['puuid'] ?? null,
                'game_name' => $riotAccount['gameName'] ?? null,
                'tag_line' => $riotAccount['tagLine'] ?? null,
                'summoner_name' => $riotAccount['summonerName'] ?? null,
                'region' => $riotAccount['region'] ?? config('tracker.riot_region', 'BR1'),
                'current_game_id' => $currentGame['gameId'] ?? null,
                'current_queue_id' => $currentGame['queueId'] ?? null,
                'current_champion_id' => $currentGame['championId'] ?? null,
                'ranked_snapshot' => $rankedProgress ?: $previousSession?->ranked_snapshot,
                'lp_delta' => $lpDelta,
                'progress_percent' => $progressPercent,
                'started_at' => $validated['status'] === 'IN_GAME'
                    ? Carbon::parse($currentGame['startedAt'] ?? $now)
                    : null,
                'ended_at' => in_array($validated['status'], ['OFFLINE', 'GAME_ENDED'], true) ? $now : null,
                'last_heartbeat_at' => $now,
            ],
        );

        $this->rememberRiotAccount($user, $riotAccount);

        if ($order->status !== ServiceOrderStatus::InProgress->value && $validated['status'] !== 'OFFLINE') {
            $order->forceFill([
                'status' => ServiceOrderStatus::InProgress->value,
                'started_at' => $order->started_at ?: $now,
            ])->save();
        }

        return response()->json([
            'message' => 'Acompanhamento atualizado.',
            'data' => [
                'session' => $this->serializeSession($session->refresh()->loadMissing(['booster:id,name,email,role', 'serviceOrder:id,title,status'])),
            ],
        ]);
    }

    public function linkRiotAccount(Request $request, RiotApiService $riot): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->hasRole(UserRole::Booster)) {
            return response()->json(['message' => 'Somente boosters podem vincular conta Riot.'], 403);
        }

        $validated = $request->validate([
            'gameName' => ['required', 'string', 'max:120'],
            'tagLine' => ['required', 'string', 'max:16'],
            'summonerName' => ['nullable', 'string', 'max:120'],
            'region' => ['nullable', 'string', 'max:12'],
            'puuid' => ['nullable', 'string', 'max:120'],
        ]);

        $riotAccount = $riot->accountByRiotId($validated['gameName'], $validated['tagLine']);
        $puuid = $riotAccount['puuid'] ?? $validated['puuid'] ?? null;

        $account = BoosterRiotAccount::query()->updateOrCreate(
            [
                'booster_id' => $user->getKey(),
                'puuid' => $puuid,
                'region' => $validated['region'] ?? config('tracker.riot_region', 'BR1'),
            ],
            [
                'game_name' => $validated['gameName'],
                'tag_line' => $validated['tagLine'],
                'summoner_name' => $validated['summonerName'] ?? $validated['gameName'],
                'verified_at' => $riotAccount ? now() : null,
            ],
        );

        return response()->json([
            'message' => $riotAccount ? 'Conta Riot validada.' : 'Conta Riot salva para acompanhamento.',
            'data' => ['riot_account' => $account],
        ]);
    }

    public function orderStatus(Request $request, ServiceOrder $serviceOrder): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $this->canAccessOrder($user, $serviceOrder)) {
            return response()->json(['message' => 'Voce nao tem acesso a esse acompanhamento.'], 403);
        }

        if (! $serviceOrder->booster_id) {
            return response()->json([
                'data' => [
                    'available' => false,
                    'message' => 'Aguardando booster designado.',
                    'session' => null,
                    'matches' => [],
                ],
            ]);
        }

        $session = BoosterTrackerSession::query()
            ->with(['booster:id,name,email,role'])
            ->where('service_order_id', $serviceOrder->getKey())
            ->latest('last_heartbeat_at')
            ->first();

        return response()->json([
            'data' => [
                'available' => true,
                'session' => $session ? $this->serializeSession($session) : null,
                'matches' => TrackedMatch::query()
                    ->where('service_order_id', $serviceOrder->getKey())
                    ->latest('started_at')
                    ->limit(20)
                    ->get(),
            ],
        ]);
    }

    public function matchFinished(Request $request, RiotApiService $riot): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        if (! $user->hasRole(UserRole::Booster)) {
            return response()->json(['message' => 'Somente boosters podem enviar partidas.'], 403);
        }

        $validated = $request->validate([
            'orderId' => ['required', 'integer', 'exists:service_orders,id'],
            'matchId' => ['nullable', 'string', 'max:120'],
            'gameId' => ['nullable', 'string', 'max:120'],
            'riotPuuid' => ['nullable', 'string', 'max:120'],
            'championId' => ['nullable', 'integer'],
            'queueId' => ['nullable', 'integer'],
            'result' => ['nullable', Rule::in(['WIN', 'LOSS', 'REMAKE', 'UNKNOWN', 'win', 'loss'])],
            'kills' => ['nullable', 'integer'],
            'deaths' => ['nullable', 'integer'],
            'assists' => ['nullable', 'integer'],
            'startedAt' => ['nullable', 'date'],
            'endedAt' => ['nullable', 'date'],
            'durationSeconds' => ['nullable', 'integer'],
            'rawData' => ['nullable', 'array'],
        ]);

        $order = ServiceOrder::query()->findOrFail($validated['orderId']);

        if ((int) $order->booster_id !== (int) $user->getKey()) {
            return response()->json(['message' => 'Esse pedido nao esta atribuido a voce.'], 403);
        }

        $riotMatch = isset($validated['matchId']) ? $riot->matchById($validated['matchId']) : null;
        $participant = $this->extractParticipant($riotMatch, $validated['riotPuuid'] ?? null);
        $info = $riotMatch['info'] ?? [];

        $match = TrackedMatch::query()->updateOrCreate(
            [
                'booster_id' => $user->getKey(),
                'match_id' => $validated['matchId'] ?? $validated['gameId'] ?? ('local-'.$order->getKey().'-'.now()->timestamp),
            ],
            [
                'service_order_id' => $order->getKey(),
                'riot_puuid' => $validated['riotPuuid'] ?? $participant['puuid'] ?? null,
                'game_id' => $validated['gameId'] ?? (string) ($info['gameId'] ?? ''),
                'champion_id' => $validated['championId'] ?? $participant['championId'] ?? null,
                'queue_id' => $validated['queueId'] ?? $info['queueId'] ?? null,
                'result' => strtoupper((string) ($validated['result'] ?? (($participant['win'] ?? null) === true ? 'WIN' : 'UNKNOWN'))),
                'kills' => $validated['kills'] ?? $participant['kills'] ?? null,
                'deaths' => $validated['deaths'] ?? $participant['deaths'] ?? null,
                'assists' => $validated['assists'] ?? $participant['assists'] ?? null,
                'started_at' => $validated['startedAt'] ?? (isset($info['gameStartTimestamp']) ? Carbon::createFromTimestampMs($info['gameStartTimestamp']) : null),
                'ended_at' => $validated['endedAt'] ?? now(),
                'duration_seconds' => $validated['durationSeconds'] ?? $info['gameDuration'] ?? null,
                'raw_data' => $riotMatch ?: ($validated['rawData'] ?? null),
            ],
        );

        BoosterTrackerSession::query()
            ->where('booster_id', $user->getKey())
            ->where('service_order_id', $order->getKey())
            ->update([
                'status' => 'GAME_ENDED',
                'ended_at' => now(),
                'last_heartbeat_at' => now(),
            ]);

        return response()->json([
            'message' => 'Partida registrada.',
            'data' => ['match' => $match],
        ]);
    }

    public function adminLive(): JsonResponse
    {
        $sessions = BoosterTrackerSession::query()
            ->with(['booster:id,name,email,role,profile_photo_path', 'serviceOrder:id,title,status,customer_id,booster_id'])
            ->latest('last_heartbeat_at')
            ->limit(40)
            ->get()
            ->map(fn (BoosterTrackerSession $session): array => $this->serializeSession($session));

        return response()->json(['data' => ['boosters' => $sessions]]);
    }

    private function rememberRiotAccount(User $user, array $riotAccount): void
    {
        if (blank($riotAccount['puuid'] ?? null)) {
            return;
        }

        BoosterRiotAccount::query()->updateOrCreate(
            [
                'booster_id' => $user->getKey(),
                'puuid' => $riotAccount['puuid'],
                'region' => $riotAccount['region'] ?? config('tracker.riot_region', 'BR1'),
            ],
            [
                'game_name' => $riotAccount['gameName'] ?? null,
                'tag_line' => $riotAccount['tagLine'] ?? null,
                'summoner_name' => $riotAccount['summonerName'] ?? null,
                'verified_at' => now(),
            ],
        );
    }

    private function canAccessOrder(User $user, ServiceOrder $order): bool
    {
        return (int) $order->customer_id === (int) $user->getKey()
            || (int) $order->booster_id === (int) $user->getKey()
            || $user->hasRole(UserRole::MasterAdmin)
            || $user->hasRole(UserRole::Staff);
    }

    private function serializeSession(BoosterTrackerSession $session): array
    {
        return [
            'id' => $session->getKey(),
            'booster_id' => $session->booster_id,
            'order_id' => $session->service_order_id,
            'status' => $session->status,
            'riot_account' => [
                'puuid' => $session->riot_puuid,
                'gameName' => $session->game_name,
                'tagLine' => $session->tag_line,
                'summonerName' => $session->summoner_name,
                'region' => $session->region,
            ],
            'current_game' => [
                'gameId' => $session->current_game_id,
                'queueId' => $session->current_queue_id,
                'championId' => $session->current_champion_id,
                'startedAt' => $session->started_at?->toIso8601String(),
            ],
            'ranked_progress' => [
                'snapshot' => $session->ranked_snapshot,
                'lpDelta' => $session->lp_delta,
                'progressPercent' => (float) $session->progress_percent,
            ],
            'started_at' => $session->started_at?->toIso8601String(),
            'ended_at' => $session->ended_at?->toIso8601String(),
            'last_heartbeat_at' => $session->last_heartbeat_at?->toIso8601String(),
            'booster' => $session->booster,
            'order' => $session->serviceOrder,
        ];
    }

    private function extractParticipant(?array $match, ?string $puuid): ?array
    {
        if (! $match || ! $puuid) {
            return null;
        }

        foreach (($match['info']['participants'] ?? []) as $participant) {
            if (($participant['puuid'] ?? null) === $puuid) {
                return $participant;
            }
        }

        return null;
    }

    private function calculateLpDelta(?array $previous, ?array $current): ?int
    {
        if (! $previous || ! $current) {
            return null;
        }

        $previousTier = $previous['tier'] ?? null;
        $previousDivision = $previous['division'] ?? null;
        $currentTier = $current['tier'] ?? null;
        $currentDivision = $current['division'] ?? null;

        if ($previousTier !== $currentTier || $previousDivision !== $currentDivision) {
            return null;
        }

        if (! isset($previous['leaguePoints'], $current['leaguePoints'])) {
            return null;
        }

        return (int) $current['leaguePoints'] - (int) $previous['leaguePoints'];
    }

    private function calculateProgressPercent(ServiceOrder $order, ?array $rankedProgress): float
    {
        if (! $rankedProgress) {
            return 0.0;
        }

        $metadata = $order->metadata ?? [];
        $currentScore = $this->rankScore($rankedProgress['tier'] ?? null, $rankedProgress['division'] ?? null, $rankedProgress['leaguePoints'] ?? 0);
        $startScore = $this->rankScore($metadata['current_tier'] ?? null, $metadata['current_division'] ?? null, 0);
        $targetScore = $this->rankScore($metadata['target_tier'] ?? null, $metadata['target_division'] ?? null, 100);

        if ($targetScore <= $startScore) {
            return 0.0;
        }

        return round(max(0, min(100, (($currentScore - $startScore) / ($targetScore - $startScore)) * 100)), 2);
    }

    private function rankScore(?string $tier, ?string $division, int|string|null $lp): int
    {
        $tierOrder = [
            'iron' => 0,
            'bronze' => 1,
            'silver' => 2,
            'gold' => 3,
            'platinum' => 4,
            'emerald' => 5,
            'diamond' => 6,
            'master' => 7,
            'grandmaster' => 8,
            'challenger' => 9,
        ];
        $divisionOrder = ['IV' => 0, 'III' => 1, 'II' => 2, 'I' => 3];
        $tierKey = strtolower((string) $tier);
        $divisionKey = strtoupper((string) $division);

        return (($tierOrder[$tierKey] ?? 0) * 400)
            + (($divisionOrder[$divisionKey] ?? 0) * 100)
            + max(0, min(100, (int) $lp));
    }
}
