<?php

namespace App\Http\Controllers\Api\Admin;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

final class PricingController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $path = storage_path('app/pricing.json');

        if (! file_exists($path)) {
            return response()->json(['data' => ['pricing' => []]]);
        }

        $content = json_decode((string) file_get_contents($path), true);

        return response()->json(['data' => ['pricing' => $content]]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pricing' => ['required', 'array'],
        ]);

        $path = storage_path('app/pricing.json');
        $json = json_encode($validated['pricing'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        file_put_contents($path, $json);

        return response()->json(['message' => 'Pricing updated.', 'data' => ['pricing' => $validated['pricing']]]);
    }
}
