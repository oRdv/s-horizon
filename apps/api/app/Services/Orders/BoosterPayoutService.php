<?php

namespace App\Services\Orders;

use App\Models\ServiceOrder;

final class BoosterPayoutService
{
    public function totalCents(ServiceOrder $order): int
    {
        if ($order->final_price !== null) {
            return max(0, (int) $order->final_price);
        }

        if ($order->base_price !== null) {
            return max(0, (int) $order->base_price);
        }

        return max(0, (int) round(((float) $order->price) * 100));
    }

    public function payoutCents(ServiceOrder $order): int
    {
        return intdiv(($this->totalCents($order) * $this->basisPoints()) + 5000, 10000);
    }

    public function payoutAmount(ServiceOrder $order): float
    {
        return round($this->payoutCents($order) / 100, 2);
    }

    public function totalAmount(ServiceOrder $order): float
    {
        return round($this->totalCents($order) / 100, 2);
    }

    public function percentForMetadata(): int|float
    {
        $basisPoints = $this->basisPoints();

        return $basisPoints % 100 === 0 ? intdiv($basisPoints, 100) : $basisPoints / 100;
    }

    private function basisPoints(): int
    {
        $value = (string) config('payments.booster_payout_percent', '70');
        $normalized = str_replace(',', '.', trim($value));

        if ($normalized === '' || ! preg_match('/^\d+(\.\d{1,2})?$/', $normalized)) {
            return 7000;
        }

        [$whole, $fraction] = array_pad(explode('.', $normalized, 2), 2, '');
        $basisPoints = ((int) $whole * 100) + (int) str_pad(substr($fraction, 0, 2), 2, '0');

        return max(0, min(10000, $basisPoints));
    }
}
