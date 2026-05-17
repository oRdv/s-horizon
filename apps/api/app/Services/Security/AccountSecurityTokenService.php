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
use Illuminate\Support\Facades\View;
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

        $this->send($email, $purpose, $token, $ttlMinutes);

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
                'token' => ['O token informado é inválido ou expirou.'],
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

    private function send(string $email, SecurityTokenPurpose $purpose, string $token, int $ttlMinutes): void
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
            SecurityTokenPurpose::ProfileChange => 'Confirme a alteração do seu perfil',
            SecurityTokenPurpose::PasswordChange => 'Confirme a troca de senha',
            SecurityTokenPurpose::TwoFactorSetup => 'Confirme a autenticação em duas etapas',
            SecurityTokenPurpose::TwoFactorLogin => 'Código de login em duas etapas',
        };

        $html = View::make('emails.security-token', [
            'subject' => $subject,
            'headline' => $this->headlineFor($purpose),
            'intro' => $this->introFor($purpose),
            'token' => $token,
            'expiresInMinutes' => $ttlMinutes,
            'frontendUrl' => config('payments.frontend_url'),
        ])->render();

        Mail::html(
            $html,
            static function ($message) use ($email, $subject): void {
                $message->to($email)->subject($subject);
            },
        );

        Log::info('mail.security_token_send_success', $context);
    }

    private function headlineFor(SecurityTokenPurpose $purpose): string
    {
        return match ($purpose) {
            SecurityTokenPurpose::EmailVerification => 'Confirme seu cadastro',
            SecurityTokenPurpose::ProfileChange => 'Confirme a alteração',
            SecurityTokenPurpose::PasswordChange => 'Confirme sua nova senha',
            SecurityTokenPurpose::TwoFactorSetup => 'Ative a proteção extra',
            SecurityTokenPurpose::TwoFactorLogin => 'Confirme seu login',
        };
    }

    private function introFor(SecurityTokenPurpose $purpose): string
    {
        return match ($purpose) {
            SecurityTokenPurpose::EmailVerification => 'Use o código abaixo para verificar seu e-mail e liberar sua conta na Horizon Boost.',
            SecurityTokenPurpose::ProfileChange => 'Recebemos uma solicitação para alterar dados da sua conta. Use o código abaixo para confirmar.',
            SecurityTokenPurpose::PasswordChange => 'Use o código abaixo para confirmar a troca de senha da sua conta.',
            SecurityTokenPurpose::TwoFactorSetup => 'Use o código abaixo para concluir a ativação da autenticação em duas etapas.',
            SecurityTokenPurpose::TwoFactorLogin => 'Use o código abaixo para concluir o acesso seguro à sua conta.',
        };
    }
}
