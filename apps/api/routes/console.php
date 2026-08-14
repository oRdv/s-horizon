<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use App\Services\Payments\PaymentService;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::call(fn () => app(PaymentService::class)->reconcilePendingMercadoPagoPayments())
    ->name('payments:reconcile-mercado-pago')
    ->everyMinute()
    ->withoutOverlapping();
