<?php

namespace App\Enums;

enum StaffProfile: string
{
    case Operations = 'operations';
    case Finance = 'finance';

    public function label(): string
    {
        return match ($this) {
            self::Operations => 'Staff operacional',
            self::Finance => 'Staff financeiro',
        };
    }
}
