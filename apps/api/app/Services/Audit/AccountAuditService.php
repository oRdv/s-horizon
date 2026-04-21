<?php

namespace App\Services\Audit;

use App\Models\AccountAuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

final class AccountAuditService
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function record(
        string $action,
        ?User $user = null,
        ?User $actor = null,
        ?Request $request = null,
        ?Model $auditable = null,
        array $metadata = [],
    ): AccountAuditLog {
        return AccountAuditLog::query()->create([
            'user_id' => $user?->getKey(),
            'actor_id' => $actor?->getKey(),
            'action' => $action,
            'auditable_type' => $auditable?->getMorphClass(),
            'auditable_id' => $auditable?->getKey(),
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
            'metadata' => $metadata,
        ]);
    }
}
