<?php

namespace App\Services\Payments;

use App\Models\PaymentTransaction;

interface PaymentGateway
{
    /**
     * @return array<string, mixed>
     */
    public function createPayment(PaymentTransaction $transaction): array;
}
