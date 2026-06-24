<?php

namespace App\Services\Notifications;

use App\Models\BoosterApplication;

final class BoosterApplicationNotificationService
{
    public function __construct(private readonly NotificationDispatcher $dispatcher)
    {
    }

    public function submitted(BoosterApplication $application): void
    {
        $user = $application->user;

        if (! $user) {
            return;
        }

        $this->dispatcher->dispatch(
            new NotificationMessage(
                key: 'booster_application.submitted',
                title: 'Inscrição de booster recebida - Horizon Boost',
                body: "Recebemos sua inscrição para booster na Horizon Boost.\n\nNossa equipe vai revisar sua ficha e você receberá atualizações por este e-mail.",
                channels: ['email'],
            ),
            [$user],
        );
    }

    public function approved(BoosterApplication $application): void
    {
        $user = $application->user;

        if (! $user) {
            return;
        }

        $this->dispatcher->dispatch(
            new NotificationMessage(
                key: 'booster_application.approved',
                title: 'Você foi aprovado como booster - Horizon Boost',
                body: "Sua inscrição foi aprovada.\n\nVocê já pode entrar na Horizon Boost com este e-mail e acessar seu painel de booster.",
                channels: ['email'],
            ),
            [$user],
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

        $this->dispatcher->dispatch(
            new NotificationMessage(
                key: 'booster_application.rejected',
                title: 'Atualização da sua inscrição de booster - Horizon Boost',
                body: 'Sua inscrição de booster foi revisada e não foi aprovada neste momento.'.$notes,
                channels: ['email'],
            ),
            [$user],
        );
    }
}
