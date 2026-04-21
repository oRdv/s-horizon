<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\BoosterApplication;
use App\Models\User;
use App\Services\Audit\AccountAuditService;
use App\Services\Notifications\BoosterApplicationNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class BoosterApplicationController extends Controller
{
    public function mine(Request $request): JsonResponse
    {
        $application = BoosterApplication::query()
            ->whereBelongsTo($request->user())
            ->latest()
            ->first();

        return response()->json([
            'data' => [
                'application' => $application,
            ],
        ]);
    }

    public function publicStore(
        Request $request,
        AccountAuditService $audit,
        BoosterApplicationNotificationService $notifications,
    ): JsonResponse {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)],
            ...$this->rules(),
        ]);

        [$user, $application] = DB::transaction(function () use ($validated, $request, $audit): array {
            $user = User::query()->create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make((string) $validated['password']),
                'role' => UserRole::Customer->value,
                'is_active' => true,
            ]);

            $application = BoosterApplication::query()->create([
                ...$this->onlyApplicationPayload($validated),
                'user_id' => $user->getKey(),
                'status' => 'pending',
                'submitted_at' => now(),
            ]);

            $audit->record('booster_applications.public_submitted', $user, $user, $request, $application);

            return [$user, $application];
        });

        $application->setRelation('user', $user);
        $notifications->submitted($application);

        return response()->json([
            'message' => 'Inscrição enviada para análise.',
            'data' => [
                'user' => $user,
                'application' => $application->refresh()->load('user'),
            ],
        ], 201);
    }

    public function store(
        Request $request,
        AccountAuditService $audit,
        BoosterApplicationNotificationService $notifications,
    ): JsonResponse
    {
        if ($request->user()->hasRole(UserRole::Booster)) {
            return response()->json([
                'message' => 'Sua conta já está aprovada como Booster.',
            ], 422);
        }

        $validated = $request->validate($this->rules());

        $existingApproved = BoosterApplication::query()
            ->whereBelongsTo($request->user())
            ->where('status', 'approved')
            ->exists();

        if ($existingApproved) {
            return response()->json([
                'message' => 'Você já possui uma inscrição aprovada.',
            ], 422);
        }

        $application = BoosterApplication::query()->updateOrCreate(
            [
                'user_id' => $request->user()->getKey(),
                'status' => 'pending',
            ],
            [
                ...$this->onlyApplicationPayload($validated),
                'submitted_at' => now(),
                'reviewed_by' => null,
                'reviewed_at' => null,
                'review_notes' => null,
            ],
        );

        $audit->record('booster_applications.submitted', $request->user(), $request->user(), $request, $application);
        $notifications->submitted($application->refresh()->load('user'));

        return response()->json([
            'message' => 'Inscrição enviada para análise.',
            'data' => [
                'application' => $application->refresh(),
            ],
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status', 'pending');

        $applications = BoosterApplication::query()
            ->with('user')
            ->when(is_string($status) && $status !== 'all', fn ($query) => $query->where('status', $status))
            ->latest('submitted_at')
            ->paginate(20);

        return response()->json([
            'data' => [
                'applications' => $applications,
            ],
        ]);
    }

    public function approve(
        Request $request,
        BoosterApplication $boosterApplication,
        AccountAuditService $audit,
        BoosterApplicationNotificationService $notifications,
    ): JsonResponse {
        $this->ensurePending($boosterApplication);

        DB::transaction(function () use ($request, $boosterApplication, $audit): void {
            $user = $boosterApplication->user()->lockForUpdate()->firstOrFail();

            $user->forceFill([
                'role' => UserRole::Booster->value,
                'staff_profile' => null,
                'approved_at' => now(),
                'approved_by' => $request->user()?->getKey(),
            ])->save();

            $user->boosterProfile()->updateOrCreate(
                ['user_id' => $user->getKey()],
                $this->profilePayload($boosterApplication),
            );

            $boosterApplication->forceFill([
                'status' => 'approved',
                'reviewed_by' => $request->user()?->getKey(),
                'reviewed_at' => now(),
                'review_notes' => $request->string('review_notes')->trim()->toString() ?: null,
            ])->save();

            $audit->record('booster_applications.approved', $user, $request->user(), $request, $boosterApplication);
        });

        $notifications->approved($boosterApplication->refresh()->load('user'));

        return response()->json([
            'message' => 'Inscrição aprovada e usuário promovido para Booster.',
            'data' => [
                'application' => $boosterApplication->refresh()->load('user'),
            ],
        ]);
    }

    public function reject(
        Request $request,
        BoosterApplication $boosterApplication,
        AccountAuditService $audit,
        BoosterApplicationNotificationService $notifications,
    ): JsonResponse {
        $this->ensurePending($boosterApplication);

        $validated = $request->validate([
            'review_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $boosterApplication->forceFill([
            'status' => 'rejected',
            'reviewed_by' => $request->user()?->getKey(),
            'reviewed_at' => now(),
            'review_notes' => $validated['review_notes'] ?? null,
        ])->save();

        $audit->record(
            'booster_applications.rejected',
            $boosterApplication->user,
            $request->user(),
            $request,
            $boosterApplication,
        );

        $notifications->rejected($boosterApplication->refresh()->load('user'));

        return response()->json([
            'message' => 'Inscrição rejeitada.',
            'data' => [
                'application' => $boosterApplication->refresh()->load('user'),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(): array
    {
        return [
            'full_name' => ['required', 'string', 'max:255'],
            'birth_date' => ['required', 'date'],
            'age' => ['required', 'integer', 'min:13', 'max:120'],
            'cpf' => ['required', 'string', 'max:20'],
            'pix_key' => ['required', 'string', 'max:255'],
            'gender' => ['required', 'string', 'max:80'],
            'in_game_nick' => ['required', 'string', 'max:120'],
            'highest_rank' => ['required', 'string', 'max:120'],
            'previous_season_rank' => ['required', 'string', 'max:120'],
            'available_hours' => ['required', 'string', 'max:2000'],
            'location' => ['required', 'string', 'max:255'],
            'accepts_riot_responsibility' => ['accepted'],
            'accepts_confidentiality_terms' => ['accepted'],
            'initial_percentage' => ['nullable', 'numeric', 'in:65'],
            'accepts_initial_percentage' => ['nullable', 'boolean'],
            'opgg_url' => ['required', 'string', 'max:255'],
            'discord_username' => ['required', 'string', 'max:120'],
            'diamond_plus_eta' => ['required', 'string', 'max:255'],
            'accepts_cashflow_decay' => ['accepted'],
        ];
    }

    private function ensurePending(BoosterApplication $application): void
    {
        abort_if($application->status !== 'pending', 422, 'Essa inscrição já foi revisada.');
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    private function onlyApplicationPayload(array $validated): array
    {
        $payload = [];

        foreach (array_keys($this->rules()) as $field) {
            $payload[$field] = $validated[$field] ?? null;
        }

        $payload['initial_percentage'] = 65;
        $payload['accepts_initial_percentage'] = true;

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    private function profilePayload(BoosterApplication $application): array
    {
        return [
            'full_name' => $application->full_name,
            'birth_date' => $application->birth_date,
            'age' => $application->age,
            'cpf' => $application->cpf,
            'pix_key' => $application->pix_key,
            'gender' => $application->gender,
            'in_game_nick' => $application->in_game_nick,
            'highest_rank' => $application->highest_rank,
            'previous_season_rank' => $application->previous_season_rank,
            'available_hours' => $application->available_hours,
            'location' => $application->location,
            'accepts_riot_responsibility' => $application->accepts_riot_responsibility,
            'accepts_confidentiality_terms' => $application->accepts_confidentiality_terms,
            'initial_percentage' => $application->initial_percentage,
            'accepts_initial_percentage' => $application->accepts_initial_percentage,
            'opgg_url' => $application->opgg_url,
            'discord_username' => $application->discord_username,
            'diamond_plus_eta' => $application->diamond_plus_eta,
            'accepts_cashflow_decay' => $application->accepts_cashflow_decay,
        ];
    }
}
