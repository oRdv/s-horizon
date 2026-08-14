<?php

namespace App\Http\Controllers\Api;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\LandingBooster;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LandingBoosterController extends Controller
{
    public function publicIndex(): JsonResponse
    {
        return response()->json([
            'data' => [
                'boosters' => LandingBooster::query()
                    ->where('is_active', true)
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get(),
            ],
        ]);
    }

    public function index(): JsonResponse
    {
        return response()->json([
            'data' => [
                'boosters' => LandingBooster::query()
                    ->with('user:id,name,email,role')
                    ->orderBy('sort_order')
                    ->orderBy('id')
                    ->get(),
                'booster_users' => User::query()
                    ->where('role', UserRole::Booster->value)
                    ->orderBy('name')
                    ->get(['id', 'name', 'email', 'role']),
            ],
        ]);
    }

    public function selectable(): JsonResponse
    {
        return response()->json([
            'data' => [
                'boosters' => User::query()
                    ->where('role', UserRole::Booster->value)
                    ->where('is_active', true)
                    ->with('boosterProfile:id,user_id,in_game_nick,highest_rank')
                    ->orderBy('name')
                    ->get(['id', 'name', 'role', 'profile_photo_path']),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $booster = LandingBooster::query()->create($this->validated($request));

        return response()->json([
            'data' => [
                'booster' => $booster->load('user:id,name,email,role'),
            ],
        ], 201);
    }

    public function update(Request $request, LandingBooster $landingBooster): JsonResponse
    {
        $landingBooster->update($this->validated($request));

        return response()->json([
            'data' => [
                'booster' => $landingBooster->refresh()->load('user:id,name,email,role'),
            ],
        ]);
    }

    public function destroy(LandingBooster $landingBooster): JsonResponse
    {
        $landingBooster->delete();

        return response()->json([
            'data' => [
                'deleted' => true,
            ],
        ]);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('role', UserRole::Booster->value)],
            'nick' => ['required', 'string', 'max:120'],
            'champion_name' => ['required', 'string', 'max:120'],
            'rank_label' => ['required', 'string', 'max:120'],
            'rank_key' => ['required', Rule::in(['iron', 'bronze', 'silver', 'gold', 'platinum', 'emerald', 'diamond', 'master', 'grandmaster', 'challenger'])],
            'game' => ['required', 'string', 'max:80'],
            'sort_order' => ['required', 'integer', 'min:0', 'max:999'],
            'is_active' => ['required', 'boolean'],
        ]);
    }
}
