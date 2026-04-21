<?php

namespace App\Services\Auth;

use App\Enums\Permission;
use App\Enums\StaffProfile;
use App\Enums\UserRole;
use App\Models\User;

final class PermissionRegistry
{
    /**
     * @return array<int, string>
     */
    public function all(): array
    {
        return array_map(
            static fn (Permission $permission): string => $permission->value,
            Permission::cases(),
        );
    }

    /**
     * @return array<int, string>
     */
    public function forUser(User $user): array
    {
        $role = UserRole::tryFrom((string) $user->role);

        if ($role === UserRole::MasterAdmin) {
            return $this->all();
        }

        $defaults = match ($role) {
            UserRole::Staff => $this->staffPermissions($user),
            UserRole::Booster => $this->boosterPermissions(),
            UserRole::Customer => $this->customerPermissions(),
            default => [],
        };

        $custom = is_array($user->permissions) ? $user->permissions : [];

        return array_values(array_unique([
            ...$defaults,
            ...array_filter($custom, 'is_string'),
        ]));
    }

    public function userHas(User $user, Permission|string $permission): bool
    {
        $slug = $permission instanceof Permission ? $permission->value : $permission;

        return in_array($slug, $this->forUser($user), true);
    }

    /**
     * @return array<int, array{slug: string, label: string}>
     */
    public function catalog(): array
    {
        return array_map(
            static fn (Permission $permission): array => [
                'slug' => $permission->value,
                'label' => $permission->label(),
            ],
            Permission::cases(),
        );
    }

    /**
     * @return array<int, string>
     */
    private function staffPermissions(User $user): array
    {
        $normal = [
            Permission::ViewBoosters->value,
            Permission::CreateBoosters->value,
            Permission::ViewBoosterProgress->value,
            Permission::ViewOperationOrders->value,
            Permission::ManageOwnProfile->value,
            Permission::ManageOwnSecurity->value,
        ];

        if ($user->staff_profile === StaffProfile::Finance->value) {
            return [
                ...$normal,
                Permission::ViewBoosterPayments->value,
                Permission::ViewFinancialControl->value,
                Permission::ViewGlobalGoals->value,
                Permission::ViewBoosterGoals->value,
                Permission::ManageWithdrawals->value,
                Permission::ViewPaymentHistory->value,
            ];
        }

        return $normal;
    }

    /**
     * @return array<int, string>
     */
    private function boosterPermissions(): array
    {
        return [
            Permission::ViewOperationOrders->value,
            Permission::ViewBoosterProgress->value,
            Permission::ViewBoosterGoals->value,
            Permission::ViewPaymentHistory->value,
            Permission::RequestWithdrawals->value,
            Permission::ManageOwnProfile->value,
            Permission::ManageOwnSecurity->value,
        ];
    }

    /**
     * @return array<int, string>
     */
    private function customerPermissions(): array
    {
        return [
            Permission::CreateCustomerPayments->value,
            Permission::ViewCustomerPurchases->value,
            Permission::ViewPaymentHistory->value,
            Permission::ManageOwnProfile->value,
            Permission::ManageOwnSecurity->value,
        ];
    }
}
