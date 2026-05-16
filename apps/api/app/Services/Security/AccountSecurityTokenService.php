<?php

namespace App\Services\Security;

use App\Enums\SecurityTokenPurpose;
use App\Models\AccountSecurityToken;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

final class AccountSecurityTokenService
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array{record: AccountSecurityToken, token: string}
     */
    public function issue(
        ?User $user,
        string $email,
        SecurityTokenPurpose $purpose,
        array $payload = [],
        ?Request $request = null,
        int $ttlMinutes = 30,
    ): array {
        $token = (string) random_int(100000, 999999);

        AccountSecurityToken::query()
            ->where('email', $email)
            ->where('purpose', $purpose->value)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => CarbonImmutable::now()]);

        $record = AccountSecurityToken::query()->create([
            'user_id' => $user?->getKey(),
            'email' => $email,
            'purpose' => $purpose->value,
            'token_hash' => Hash::make($token),
            'payload' => $payload,
            'expires_at' => CarbonImmutable::now()->addMinutes($ttlMinutes),
            'ip_address' => $request?->ip(),
            'user_agent' => $request?->userAgent(),
        ]);

        $this->send($email, $purpose, $token);

        return [
            'record' => $record,
            'token' => $token,
        ];
    }

    public function consume(string $email, SecurityTokenPurpose $purpose, string $token): AccountSecurityToken
    {
        $validator = Validator::make([
            'token' => $token,
        ], [
            'token' => ['required', 'digits:6'],
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        /** @var AccountSecurityToken|null $record */
        $record = AccountSecurityToken::query()
            ->where('email', $email)
            ->where('purpose', $purpose->value)
            ->whereNull('consumed_at')
            ->latest()
            ->first();

        if (! $record || $record->isExpired() || ! Hash::check($token, $record->token_hash)) {
            throw ValidationException::withMessages([
                'token' => ['O token informado e invalido ou expirou.'],
            ]);
        }

        $record->forceFill([
            'consumed_at' => CarbonImmutable::now(),
        ])->save();

        return $record;
    }

    /**
     * @return array<string, mixed>
     */
    public function exposeForLocalDevelopment(array $issued): array
    {
        if (app()->isProduction()) {
            return [
                'token_sent' => true,
            ];
        }

        return [
            'token_sent' => true,
            'dev_token' => $issued['token'],
        ];
    }

    private function send(string $email, SecurityTokenPurpose $purpose, string $token): void
    {
        $context = [
            'email_hash' => hash('sha256', strtolower($email)),
            'purpose' => $purpose->value,
            'mailer' => config('mail.default'),
            'host' => config('mail.mailers.smtp.host'),
            'port' => config('mail.mailers.smtp.port'),
            'scheme' => config('mail.mailers.smtp.scheme'),
            'from_address' => config('mail.from.address'),
        ];

        Log::info('mail.security_token_send_attempt', $context);

        $subject = match ($purpose) {
            SecurityTokenPurpose::EmailVerification => 'Confirme seu cadastro na Horizon Boost',
            SecurityTokenPurpose::ProfileChange => 'Confirme a alteracao do seu perfil',
            SecurityTokenPurpose::PasswordChange => 'Confirme a troca de senha',
            SecurityTokenPurpose::TwoFactorSetup => 'Confirme a autenticacao em duas etapas',
            SecurityTokenPurpose::TwoFactorLogin => 'Codigo de login em duas etapas',
        };

        Mail::raw(
            "Seu codigo Horizon Boost e {$token}. Ele expira em 30 minutos.",
            static function ($message) use ($email, $subject): void {
                $message->to($email)->subject($subject);
            },
        );

        Log::info('mail.security_token_send_success', $context);
    }
}
