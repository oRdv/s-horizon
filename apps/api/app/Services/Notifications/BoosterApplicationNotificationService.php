<?php

namespace App\Services\Notifications;

use App\Models\BoosterApplication;
use Illuminate\Support\Facades\Mail;

final class BoosterApplicationNotificationService
{
    public function submitted(BoosterApplication $application): void
    {
        $user = $application->user;

        if (! $user) {
            return;
        }

        Mail::raw(
            "Recebemos sua inscrição para booster na Horizon Boost.\n\n".
            "Nossa equipe vai revisar sua ficha e você receberá atualizações por este e-mail.",
            static function ($message) use ($user): void {
                $message
                    ->to($user->email)
                    ->subject('Inscrição de booster recebida - Horizon Boost');
            },
        );
    }

    public function approved(BoosterApplication $application): void
    {
        $user = $application->user;

        if (! $user) {
            return;
        }

        Mail::raw(
            "Sua inscrição foi aprovada.\n\n".
            "Você já pode entrar na Horizon Boost com este e-mail e acessar seu painel de booster.",
            static function ($message) use ($user): void {
                $message
                    ->to($user->email)
                    ->subject('Você foi aprovado como booster - Horizon Boost');
            },
        );
    }

    public function rejected(BoosterApplication $application): void
    {
        $user = $application->user;

        if (! $user) {
            return;
        }

        $notes = $application->review_notes
            ? "\n\nObservação da equipe: {$application->review_notes}"
            : '';

        Mail::raw(
            "Sua inscrição de booster foi revisada e não foi aprovada neste momento.".$notes,
            static function ($message) use ($user): void {
                $message
                    ->to($user->email)
                    ->subject('Atualização da sua inscrição de booster - Horizon Boost');
            },
        );
    }
}
