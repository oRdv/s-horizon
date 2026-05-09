<?php

namespace App\Enums;

enum ServiceOrderStatus: string
{
    case Pending = 'PENDING';
    case WaitingPayment = 'WAITING_PAYMENT';
    case Paid = 'PAID';
    case WaitingBooster = 'WAITING_BOOSTER';
    case BoosterAssigned = 'BOOSTER_ASSIGNED';
    case Assigned = 'ASSIGNED';
    case InProgress = 'IN_PROGRESS';
    case Completed = 'COMPLETED';
    case Cancelled = 'CANCELLED';
    case Failed = 'FAILED';
    case Refunded = 'REFUNDED';
    case Expired = 'EXPIRED';
}
