<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\TournamentRegistration;
use App\Models\User;
use App\Services\Audit\AccountAuditService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TournamentRegistrationController extends Controller
{
    /**
     * @var array<string, array{game: string, title: string, roster_size: int, substitute_slots: int}>
     */
    private const CATEGORIES = [
        'lol-5v5' => [
            'game' => 'lol',
            'title' => 'League of Legends 5v5',
            'roster_size' => 5,
            'substitute_slots' => 2,
        ],
        'lol-1v1' => [
            'game' => 'lol',
            'title' => 'League of Legends 1v1',
            'roster_size' => 1,
            'substitute_slots' => 0,
        ],
        'wild-rift-5v5' => [
            'game' => 'wild_rift',
            'title' => 'Wild Rift 5v5',
            'roster_size' => 5,
            'substitute_slots' => 2,
        ],
        'wild-rift-1v1' => [
            'game' => 'wild_rift',
            'title' => 'Wild Rift 1v1',
            'roster_size' => 1,
            'substitute_slots' => 0,
        ],
    ];

    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $registrations = TournamentRegistration::query()
            ->whereBelongsTo($user)
            ->latest('submitted_at')
            ->paginate(20);

        return response()->json([
            'data' => [
                'registrations' => $registrations,
            ],
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'game' => ['nullable', Rule::in(['lol', 'wild_rift'])],
            'status' => ['nullable', 'string', 'max:40'],
        ]);

        $query = TournamentRegistration::query()
            ->with('user')
            ->when(
                isset($validated['game']),
                fn (Builder $builder): Builder => $builder->where('game', $validated['game']),
            )
            ->when(
                isset($validated['status']) && $validated['status'] !== 'all',
                fn (Builder $builder): Builder => $builder->where('status', $validated['status']),
            );

        $summaryQuery = TournamentRegistration::query();

        return response()->json([
            'data' => [
                'summary' => [
                    'total' => (clone $summaryQuery)->count(),
                    'teams' => (clone $summaryQuery)->distinct()->count('team_name'),
                    'pending' => (clone $summaryQuery)->where('status', 'pending')->count(),
                    'lol' => (clone $summaryQuery)->where('game', 'lol')->count(),
                    'wild_rift' => (clone $summaryQuery)->where('game', 'wild_rift')->count(),
                ],
                'registrations' => $query->latest('submitted_at')->paginate(20),
            ],
        ]);
    }

    public function adminShow(TournamentRegistration $tournamentRegistration): JsonResponse
    {
        return response()->json([
            'data' => [
                'registration' => $tournamentRegistration->load('user'),
            ],
        ]);
    }

    public function store(Request $request, AccountAuditService $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless($user->hasRole(UserRole::Customer), 403, 'Somente clientes podem se inscrever em campeonatos.');

        $validated = $request->validate([
            'game' => ['required', Rule::in(['lol', 'wild_rift'])],
            'category_id' => ['required', Rule::in(array_keys(self::CATEGORIES))],
            'team_name' => ['required', 'string', 'max:160'],
            'team_tag' => ['required', 'string', 'max:20'],
            'captain_name' => ['required', 'string', 'max:160'],
            'captain_email' => ['required', 'email', 'max:255'],
            'captain_phone' => ['nullable', 'string', 'max:30'],
            'captain_discord' => ['required', 'string', 'max:120'],
            'server' => ['required', 'string', 'max:80'],
            'team_discord' => ['nullable', 'string', 'max:255'],
            'how_found' => ['nullable', 'string', 'max:255'],
            'roster' => ['required', 'array', 'min:1', 'max:7'],
            'roster.*.nick' => ['required', 'string', 'max:120'],
            'roster.*.riot_id' => ['required', 'string', 'max:120'],
            'roster.*.role' => ['nullable', 'string', 'max:80'],
            'roster.*.rank' => ['nullable', 'string', 'max:80'],
            'roster.*.discord' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2500'],
            'accepted_rules' => ['accepted'],
            'accepted_check_in' => ['accepted'],
        ]);

        $category = self::CATEGORIES[$validated['category_id']];

        abort_if(
            $validated['game'] !== $category['game'],
            422,
            'A categoria selecionada não pertence ao jogo informado.',
        );

        abort_if(
            count($validated['roster']) < $category['roster_size'],
            422,
            'O roster não tem jogadores suficientes para essa categoria.',
        );

        abort_if(
            count($validated['roster']) > ($category['roster_size'] + $category['substitute_slots']),
            422,
            'O roster tem mais jogadores do que essa categoria permite.',
        );

        $registration = TournamentRegistration::query()->create([
            ...$validated,
            'user_id' => $user->getKey(),
            'category_title' => $category['title'],
            'status' => 'pending',
            'submitted_at' => now(),
        ]);

        $audit->record('tournaments.registration_created', $user, $user, $request, $registration);

        return response()->json([
            'message' => 'Inscrição enviada para conferência.',
            'data' => [
                'registration' => $registration->refresh(),
            ],
        ], 201);
    }
}
