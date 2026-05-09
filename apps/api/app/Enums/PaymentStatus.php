<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Pending = 'PENDING';
    case WaitingPayment = 'WAITING_PAYMENT';
    case RequiresAction = 'REQUIRES_ACTION';
    case Processing = 'PROCESSING';
    case Paid = 'PAID';
    case Failed = 'FAILED';
    case Cancelled = 'CANCELLED';
    case Refunded = 'REFUNDED';
    case Expired = 'EXPIRED';
}
