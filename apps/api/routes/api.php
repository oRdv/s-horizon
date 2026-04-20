<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\MatchReportController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

Route::middleware('auth.jwt')->group(function (): void {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/matches', [MatchReportController::class, 'store']);
});
