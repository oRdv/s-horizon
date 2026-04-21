<?php

namespace App\Enums;

enum UserRole: string
{
    case MasterAdmin = 'master_admin';
    case Staff = 'staff';
    case Booster = 'booster';
    case Customer = 'customer';

    public function label(): string
    {
        return match ($this) {
            self::MasterAdmin => 'Master Admin',
            self::Staff => 'Staff',
            self::Booster => 'Booster',
            self::Customer => 'Cliente',
        };
    }
}
