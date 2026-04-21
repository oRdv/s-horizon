<?php

namespace App\Enums;

enum ServiceOrderStatus: string
{
    case Pending = 'pending';
    case Paid = 'paid';
    case Assigned = 'assigned';
    case InProgress = 'in_progress';
    case Completed = 'completed';
    case Cancelled = 'cancelled';
}
