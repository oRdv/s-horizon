<?php

namespace App\Enums;

enum PaymentProvider: string
{
    case Stripe = 'stripe';
    case MercadoPago = 'mercado_pago';
    case Manual = 'manual';
}
