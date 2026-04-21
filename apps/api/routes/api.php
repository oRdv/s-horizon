<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BoosterApplicationController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\MatchReportController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\SecurityController;
use App\Http\Controllers\Api\TournamentRegistrationController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\WithdrawalRequestController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

Route::post('/booster-applications/public', [BoosterApplicationController::class, 'publicStore']);

Route::middleware('auth.jwt')->group(function (): void {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/matches', [MatchReportController::class, 'store']);

    Route::prefix('booster-applications')->group(function (): void {
        Route::get('/me', [BoosterApplicationController::class, 'mine']);
        Route::post('/', [BoosterApplicationController::class, 'store']);
    });

    Route::prefix('dashboards')->group(function (): void {
        Route::get('/master', [DashboardController::class, 'master'])
            ->middleware('role:master_admin');
        Route::get('/staff', [DashboardController::class, 'staff'])
            ->middleware('role:master_admin,staff');
        Route::get('/booster', [DashboardController::class, 'booster'])
            ->middleware('role:master_admin,booster');
        Route::get('/customer', [DashboardController::class, 'customer'])
            ->middleware('role:master_admin,customer');
    });

    Route::prefix('admin')->middleware('permission:users.view_all')->group(function (): void {
        Route::get('/users', [UserManagementController::class, 'index']);
        Route::post('/users', [UserManagementController::class, 'store'])
            ->middleware('permission:users.manage');
        Route::patch('/users/{user}', [UserManagementController::class, 'update'])
            ->middleware('permission:users.manage');
        Route::delete('/users/{user}', [UserManagementController::class, 'destroy'])
            ->middleware('permission:users.manage');
        Route::post('/users/{user}/activate', [UserManagementController::class, 'activate'])
            ->middleware('permission:users.activate');
        Route::post('/users/{user}/deactivate', [UserManagementController::class, 'deactivate'])
            ->middleware('permission:users.activate');

        Route::get('/booster-applications', [BoosterApplicationController::class, 'index']);
        Route::patch('/booster-applications/{boosterApplication}/approve', [BoosterApplicationController::class, 'approve'])
            ->middleware('permission:users.manage');
        Route::patch('/booster-applications/{boosterApplication}/reject', [BoosterApplicationController::class, 'reject'])
            ->middleware('permission:users.manage');
    });

    Route::prefix('admin/tournament-registrations')
        ->middleware('permission:tournaments.view_all')
        ->group(function (): void {
            Route::get('/', [TournamentRegistrationController::class, 'adminIndex']);
            Route::get('/{tournamentRegistration}', [TournamentRegistrationController::class, 'adminShow']);
        });

    Route::prefix('profile')->group(function (): void {
        Route::get('/', [ProfileController::class, 'show']);
        Route::post('/change-requests', [ProfileController::class, 'requestChange']);
        Route::post('/change-requests/confirm', [ProfileController::class, 'confirmChange']);
    });

    Route::prefix('security')->group(function (): void {
        Route::post('/email-verification/request', [SecurityController::class, 'requestEmailVerification']);
        Route::post('/email-verification/confirm', [SecurityController::class, 'verifyEmail']);
        Route::post('/two-factor/request', [SecurityController::class, 'requestTwoFactor']);
        Route::post('/two-factor/confirm', [SecurityController::class, 'confirmTwoFactor']);
        Route::delete('/two-factor', [SecurityController::class, 'disableTwoFactor']);
    });

    Route::prefix('payments')->group(function (): void {
        Route::get('/', [PaymentController::class, 'index']);
        Route::post('/customer', [PaymentController::class, 'createCustomerPayment'])
            ->middleware('permission:payments.customer.create');
    });

    Route::prefix('tournament-registrations')->middleware('role:customer')->group(function (): void {
        Route::get('/', [TournamentRegistrationController::class, 'index']);
        Route::post('/', [TournamentRegistrationController::class, 'store']);
    });

    Route::prefix('withdrawals')->group(function (): void {
        Route::get('/', [WithdrawalRequestController::class, 'index'])
            ->middleware('permission:finance.withdrawals.request,finance.withdrawals.manage');
        Route::post('/', [WithdrawalRequestController::class, 'store'])
            ->middleware('permission:finance.withdrawals.request');
        Route::patch('/{withdrawalRequest}/review', [WithdrawalRequestController::class, 'review'])
            ->middleware('permission:finance.withdrawals.manage');
    });
});
