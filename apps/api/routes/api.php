<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BoosterApplicationController;
use App\Http\Controllers\Api\BoosterTrackerController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\LandingBoosterController;
use App\Http\Controllers\Api\MatchReportController;
use App\Http\Controllers\Api\OrderChatController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\SecurityController;
use App\Http\Controllers\Api\ServiceOrderController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\WithdrawalRequestController;
use App\Http\Controllers\HealthController;
use Illuminate\Support\Facades\Route;

Route::get('/health', HealthController::class);

Route::prefix('auth')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/password/forgot', [AuthController::class, 'forgotPassword']);
    Route::post('/password/reset', [AuthController::class, 'resetPassword']);
    Route::post('/refresh', [AuthController::class, 'refresh']);
    Route::post('/logout', [AuthController::class, 'logout']);
});

Route::post('/booster-applications/public', [BoosterApplicationController::class, 'publicStore']);
Route::get('/landing/boosters', [LandingBoosterController::class, 'publicIndex']);
Route::post('/payments/stripe/webhook', [PaymentController::class, 'stripeWebhook']);
Route::post('/payments/mercado-pago/webhook', [PaymentController::class, 'mercadoPagoWebhook']);
Route::get('/booster-tracker/downloads/{platform}/signed', [BoosterTrackerController::class, 'signedDownload'])
    ->middleware('signed')
    ->name('tracker.download.signed')
    ->where('platform', 'windows');

Route::middleware('auth.jwt')->group(function (): void {
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/boosters/selectable', [LandingBoosterController::class, 'selectable'])
        ->middleware('role:customer');
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

        Route::get('/landing-boosters', [LandingBoosterController::class, 'index']);
        Route::post('/landing-boosters', [LandingBoosterController::class, 'store'])
            ->middleware('permission:users.manage');
        Route::patch('/landing-boosters/{landingBooster}', [LandingBoosterController::class, 'update'])
            ->middleware('permission:users.manage');
        Route::delete('/landing-boosters/{landingBooster}', [LandingBoosterController::class, 'destroy'])
            ->middleware('permission:users.manage');
        Route::get('/pricing', [\App\Http\Controllers\Api\Admin\PricingController::class, 'index']);
        Route::put('/pricing', [\App\Http\Controllers\Api\Admin\PricingController::class, 'update']);
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
        Route::get('/methods/{boostId}', [PaymentController::class, 'methods']);
        Route::post('/create', [PaymentController::class, 'create']);
        Route::get('/{paymentId}/status', [PaymentController::class, 'status']);
        Route::post('/customer', [PaymentController::class, 'createCustomerPayment'])
            ->middleware('permission:payments.customer.create');
    });

    Route::prefix('orders')->group(function (): void {
        Route::get('/', [ServiceOrderController::class, 'index']);
        Route::get('/{serviceOrder}', [ServiceOrderController::class, 'show']);
        Route::get('/{serviceOrder}/conversation', [OrderChatController::class, 'show']);
        Route::get('/{serviceOrder}/chat', [OrderChatController::class, 'show']);
        Route::get('/{serviceOrder}/tracker', [BoosterTrackerController::class, 'orderStatus']);
        Route::post('/{serviceOrder}/chat/messages', [OrderChatController::class, 'store']);
        Route::post('/{serviceOrder}/game-account', [ServiceOrderController::class, 'storeGameAccount']);
        Route::post('/{serviceOrder}/claim', [ServiceOrderController::class, 'claim']);
        Route::post('/{serviceOrder}/complete', [ServiceOrderController::class, 'complete']);
    });

    Route::prefix('conversations')->group(function (): void {
        Route::get('/{conversation}/messages', [OrderChatController::class, 'messages']);
        Route::post('/{conversation}/messages', [OrderChatController::class, 'storeForConversation']);
        Route::patch('/{conversation}/read', [OrderChatController::class, 'read']);
        Route::patch('/{conversation}/pin', [OrderChatController::class, 'pin']);
    });

    Route::prefix('withdrawals')->group(function (): void {
        Route::get('/', [WithdrawalRequestController::class, 'index'])
            ->middleware('permission:finance.withdrawals.request,finance.withdrawals.manage');
        Route::post('/', [WithdrawalRequestController::class, 'store'])
            ->middleware('permission:finance.withdrawals.request');
        Route::patch('/{withdrawalRequest}/review', [WithdrawalRequestController::class, 'review'])
            ->middleware('permission:finance.withdrawals.manage');
    });

    Route::prefix('booster-tracker')->group(function (): void {
        Route::get('/release', [BoosterTrackerController::class, 'release']);
        Route::post('/events', [BoosterTrackerController::class, 'event']);
        Route::get('/download/{platform}', [BoosterTrackerController::class, 'download'])
            ->where('platform', 'windows');
        Route::post('/heartbeat', [BoosterTrackerController::class, 'heartbeat']);
        Route::post('/link-riot-account', [BoosterTrackerController::class, 'linkRiotAccount']);
        Route::get('/orders/{serviceOrder}/status', [BoosterTrackerController::class, 'orderStatus']);
        Route::post('/match-finished', [BoosterTrackerController::class, 'matchFinished']);
    });

    Route::get('/admin/boosters/live', [BoosterTrackerController::class, 'adminLive'])
        ->middleware('permission:users.view_all');
});
