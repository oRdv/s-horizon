<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case Pix = 'PIX';
    case CreditCard = 'CREDIT_CARD';
    case DebitCard = 'DEBIT_CARD';
}
