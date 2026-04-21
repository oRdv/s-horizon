<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\UserRole;
use App\Services\Auth\PermissionRegistry;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable([
    'name',
    'email',
    'password',
    'role',
    'staff_profile',
    'permissions',
    'is_active',
    'two_factor_enabled',
    'two_factor_confirmed_at',
    'profile_photo_path',
    'last_login_at',
    'approved_at',
    'approved_by',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * @var array<int, string>
     */
    protected $appends = [
        'effective_permissions',
        'role_label',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'permissions' => 'array',
            'is_active' => 'boolean',
            'two_factor_enabled' => 'boolean',
            'two_factor_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function isMasterAdmin(): bool
    {
        return $this->role === UserRole::MasterAdmin->value;
    }

    public function hasRole(UserRole|string $role): bool
    {
        $roleValue = $role instanceof UserRole ? $role->value : $role;

        return $this->role === $roleValue;
    }

    public function hasPermission(string $permission): bool
    {
        return app(PermissionRegistry::class)->userHas($this, $permission);
    }

    /**
     * @return array<int, string>
     */
    public function getEffectivePermissionsAttribute(): array
    {
        return app(PermissionRegistry::class)->forUser($this);
    }

    public function getRoleLabelAttribute(): string
    {
        return UserRole::tryFrom((string) $this->role)?->label() ?? 'Usuário';
    }

    public function matchReports(): HasMany
    {
        return $this->hasMany(MatchReport::class);
    }

    public function refreshTokens(): HasMany
    {
        return $this->hasMany(RefreshToken::class);
    }

    public function customerOrders(): HasMany
    {
        return $this->hasMany(ServiceOrder::class, 'customer_id');
    }

    public function boosterProfile(): HasOne
    {
        return $this->hasOne(BoosterProfile::class);
    }

    public function boosterOrders(): HasMany
    {
        return $this->hasMany(ServiceOrder::class, 'booster_id');
    }

    public function paymentTransactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class);
    }

    public function withdrawalRequests(): HasMany
    {
        return $this->hasMany(WithdrawalRequest::class, 'booster_id');
    }

    public function tournamentRegistrations(): HasMany
    {
        return $this->hasMany(TournamentRegistration::class);
    }
}
