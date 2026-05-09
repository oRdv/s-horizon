<?php

namespace App\Enums;

enum PaymentProvider: string
{
    case Stripe = 'STRIPE';
    case MercadoPago = 'MERCADO_PAGO';
}
