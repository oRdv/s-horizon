<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Booster\StoreMatchReportRequest;
use App\Models\MatchReport;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

class MatchReportController extends Controller
{
    public function store(StoreMatchReportRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $user = $request->user();

        $attributes = [
            'result' => $validated['result'],
            'duration_seconds' => $validated['duration'],
            'played_at' => CarbonImmutable::parse($validated['timestamp']),
            'source' => $validated['source'] ?? 'desktop-app',
            'payload' => $validated['payload'] ?? null,
        ];

        if (! empty($validated['external_match_id'])) {
            $report = MatchReport::query()->updateOrCreate(
                [
                    'user_id' => $user->getKey(),
                    'external_match_id' => $validated['external_match_id'],
                ],
                $attributes,
            );
        } else {
            $report = $user->matchReports()->create($attributes);
        }

        return response()->json([
            'message' => 'Partida sincronizada com sucesso.',
            'data' => [
                'match' => $report,
            ],
        ], $report->wasRecentlyCreated ? 201 : 200);
    }
}
