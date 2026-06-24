<?php

namespace App\Http\Controllers\Api;

use App\Enums\StaffProfile;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Audit\AccountAuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $role = $request->query('role');

        $users = User::query()
            ->with('boosterProfile')
            ->when(is_string($role) && $role !== '', fn ($query) => $query->where('role', $role))
            ->latest()
            ->paginate(20);

        return response()->json([
            'data' => [
                'users' => $users,
                'roles' => array_map(
                    static fn (UserRole $role): array => ['value' => $role->value, 'label' => $role->label()],
                    UserRole::cases(),
                ),
                'staff_profiles' => array_map(
                    static fn (StaffProfile $profile): array => ['value' => $profile->value, 'label' => $profile->label()],
                    StaffProfile::cases(),
                ),
            ],
        ]);
    }

    public function store(Request $request, AccountAuditService $audit): JsonResponse
    {
        $validated = $request->validate($this->rules());
        $boosterProfile = $validated['booster_profile'] ?? null;

        unset($validated['booster_profile']);

        $user = User::query()->create([
            ...$validated,
            'password' => Hash::make($validated['password']),
            'email_verified_at' => now(),
            'approved_at' => now(),
            'approved_by' => $request->user()?->getKey(),
        ]);

        $this->syncBoosterProfile($user, $boosterProfile);

        $audit->record('users.created', $user, $request->user(), $request, $user);

        return response()->json([
            'message' => 'Usuário criado com sucesso.',
            'data' => [
                'user' => $user->load('boosterProfile'),
            ],
        ], 201);
    }

    public function update(Request $request, User $user, AccountAuditService $audit): JsonResponse
    {
        $validated = $request->validate($this->rules($user));
        $boosterProfile = $validated['booster_profile'] ?? null;

        unset($validated['booster_profile']);

        if (array_key_exists('password', $validated) && is_string($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->forceFill($validated)->save();
        $this->syncBoosterProfile($user, $boosterProfile);

        $audit->record('users.updated', $user, $request->user(), $request, $user);

        return response()->json([
            'message' => 'Usuário atualizado com sucesso.',
            'data' => [
                'user' => $user->refresh()->load('boosterProfile'),
            ],
        ]);
    }

    public function activate(Request $request, User $user, AccountAuditService $audit): JsonResponse
    {
        $user->forceFill(['is_active' => true])->save();
        $audit->record('users.activated', $user, $request->user(), $request, $user);

        return response()->json(['message' => 'Usuário ativado com sucesso.']);
    }

    public function deactivate(Request $request, User $user, AccountAuditService $audit): JsonResponse
    {
        $user->forceFill(['is_active' => false])->save();
        $audit->record('users.deactivated', $user, $request->user(), $request, $user);

        return response()->json(['message' => 'Usuário desativado com sucesso.']);
    }

    public function destroy(Request $request, User $user, AccountAuditService $audit): JsonResponse
    {
        if ((int) $request->user()?->getKey() === (int) $user->getKey()) {
            return response()->json([
                'message' => 'Você não pode excluir a própria conta logada.',
            ], 422);
        }

        if ($user->isMasterAdmin() && User::query()->where('role', UserRole::MasterAdmin->value)->count() <= 1) {
            return response()->json([
                'message' => 'Não é possível excluir o último Master Admin.',
            ], 422);
        }

        $audit->record('users.deleted', $user, $request->user(), $request, $user, [
            'deleted_user_email' => $user->email,
            'deleted_user_role' => $user->role,
        ]);

        $user->delete();

        return response()->json([
            'message' => 'Usuário excluído com sucesso.',
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function rules(?User $user = null): array
    {
        return [
            'name' => [$user ? 'sometimes' : 'required', 'string', 'max:255'],
            'email' => [
                $user ? 'sometimes' : 'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user?->getKey()),
            ],
            'password' => [$user ? 'sometimes' : 'required', 'string', 'min:8'],
            'role' => [$user ? 'sometimes' : 'required', Rule::in(array_map(static fn (UserRole $role): string => $role->value, UserRole::cases()))],
            'staff_profile' => ['nullable', Rule::in(array_map(static fn (StaffProfile $profile): string => $profile->value, StaffProfile::cases()))],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string'],
            'is_active' => ['sometimes', 'boolean'],
            'booster_profile' => ['nullable', 'array'],
            'booster_profile.full_name' => ['nullable', 'string', 'max:255'],
            'booster_profile.birth_date' => ['nullable', 'date'],
            'booster_profile.age' => ['nullable', 'integer', 'min:13', 'max:120'],
            'booster_profile.cpf' => ['nullable', 'string', 'max:20'],
            'booster_profile.pix_key' => ['nullable', 'string', 'max:255'],
            'booster_profile.gender' => ['nullable', 'string', 'max:80'],
            'booster_profile.in_game_nick' => ['nullable', 'string', 'max:120'],
            'booster_profile.highest_rank' => ['nullable', 'string', 'max:120'],
            'booster_profile.previous_season_rank' => ['nullable', 'string', 'max:120'],
            'booster_profile.available_hours' => ['nullable', 'string', 'max:2000'],
            'booster_profile.location' => ['nullable', 'string', 'max:255'],
            'booster_profile.accepts_riot_responsibility' => ['nullable', 'boolean'],
            'booster_profile.accepts_confidentiality_terms' => ['nullable', 'boolean'],
            'booster_profile.initial_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'booster_profile.accepts_initial_percentage' => ['nullable', 'boolean'],
            'booster_profile.opgg_url' => ['nullable', 'string', 'max:255'],
            'booster_profile.discord_username' => ['nullable', 'string', 'max:120'],
            'booster_profile.discord_user_id' => ['nullable', 'string', 'regex:/^\d{15,32}$/'],
            'booster_profile.diamond_plus_eta' => ['nullable', 'string', 'max:255'],
            'booster_profile.accepts_cashflow_decay' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @param array<string, mixed>|null $profile
     */
    private function syncBoosterProfile(User $user, ?array $profile): void
    {
        if (! $user->hasRole(UserRole::Booster)) {
            $user->boosterProfile()->delete();

            return;
        }

        if ($profile === null) {
            return;
        }

        $user->boosterProfile()->updateOrCreate(
            ['user_id' => $user->getKey()],
            $profile,
        );
    }
}
