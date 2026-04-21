<?php

namespace App\Enums;

enum PaymentMethod: string
{
    case Pix = 'pix';
    case Card = 'card';
}
