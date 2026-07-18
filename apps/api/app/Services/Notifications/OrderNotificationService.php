<?php

namespace App\Services\Notifications;

use App\Enums\PaymentStatus;
use App\Enums\ServiceOrderStatus;
use App\Enums\UserRole;
use App\Models\ServiceOrder;
use App\Models\User;
use App\Services\Orders\BoosterPayoutService;
use Illuminate\Support\Collection;
use Illuminate\Support\Number;

final class OrderNotificationService
{
    public function __construct(
        private readonly NotificationDispatcher $dispatcher,
        private readonly BoosterPayoutService $payouts,
    ) {
    }

    public function available(ServiceOrder $order): void
    {
        $order = $order->fresh() ?? $order;

        if (
            filled($order->booster_id)
            || $order->payment_status !== PaymentStatus::Paid->value
            || ! in_array($order->status, [
                ServiceOrderStatus::Paid->value,
                ServiceOrderStatus::WaitingBooster->value,
            ], true)
        ) {
            return;
        }

        if (filled(data_get($order->metadata ?? [], 'addons.favorite_booster'))) {
            return;
        }

        $this->dispatcher->dispatch(
            new NotificationMessage(
                key: 'order.available',
                title: "Novo pedido disponivel #{$order->getKey()}",
                body: 'Pedido pago disponivel para boosters. Confira elos, rotas preferidas, valor e restricoes antes de aceitar.',
                actionUrl: $this->frontendUrl('/booster/orders/'.$order->getKey().'?source=discord'),
                context: $this->availableOrderContext($order),
            ),
            $this->activeBoosters(),
        );
    }

    /**
     * @param array<int,string>|null $channels
     */
    public function assigned(ServiceOrder $order, ?array $channels = null): void
    {
        $order->loadMissing(['booster.boosterProfile', 'customer']);

        if (! $order->booster) {
            return;
        }

        $this->dispatcher->dispatch(
            new NotificationMessage(
                key: 'order.assigned',
                title: "Pedido #{$order->getKey()} atribuido a voce",
                body: 'O pedido foi atribuido a sua conta. Abra Meus servicos, confirme os dados do cliente e inicie o Tracker antes da partida.',
                actionUrl: $this->frontendUrl('/booster/orders/'.$order->getKey().'?source=discord'),
                context: [
                    'order_id' => $order->getKey(),
                    'route' => $this->routeLabel($order),
                    'customer' => $order->customer?->name,
                    'booster' => $order->booster?->name,
                    'discord_user_id' => $order->booster?->boosterProfile?->discord_user_id,
                    'discord_actions' => $this->assignedOrderActions($order),
                ],
                channels: $channels ?? ['email', 'discord'],
            ),
            [$order->booster],
        );
    }

    public function claimed(ServiceOrder $order): void
    {
        $order->loadMissing('booster');

        if (! $order->booster) {
            return;
        }

        $boosterName = $order->booster->name ?: 'Booster';

        $this->dispatcher->dispatch(
            new NotificationMessage(
                key: 'order.claimed',
                title: "Pedido #{$order->getKey()} foi pego",
                body: "{$boosterName} pegou o pedido. Ele nao esta mais disponivel.",
                context: [
                    'discord_deduplication_key' => 'order:'.$order->getKey(),
                ],
                channels: ['discord'],
            ),
            [$order->booster],
        );
    }

    public function gameAccountUpdated(ServiceOrder $order): void
    {
        $order->loadMissing(['booster.boosterProfile', 'customer']);

        if (! $order->booster) {
            return;
        }

        $this->dispatcher->dispatch(
            new NotificationMessage(
                key: 'order.game_account_updated',
                title: "Dados de conta recebidos no pedido #{$order->getKey()}",
                body: 'O cliente enviou ou atualizou os dados da conta do jogo. Confira no pedido antes de iniciar o servico.',
                actionUrl: $this->frontendUrl('/booster/orders/'.$order->getKey().'?source=discord'),
                context: [
                    'order_id' => $order->getKey(),
                    'route' => $this->routeLabel($order),
                    'customer' => $order->customer?->name,
                    'booster' => $order->booster?->name,
                    'discord_user_id' => $order->booster?->boosterProfile?->discord_user_id,
                    'discord_actions' => $this->assignedOrderActions($order),
                ],
                channels: ['email'],
            ),
            [$order->booster],
        );
    }

    public function completed(ServiceOrder $order): void
    {
        $order->loadMissing(['booster.boosterProfile', 'customer']);
        $recipients = array_values(array_filter([$order->booster, $order->customer]));

        $this->dispatcher->dispatch(
            new NotificationMessage(
                key: 'order.completed',
                title: "Pedido #{$order->getKey()} finalizado",
                body: 'O pedido foi marcado como finalizado. O cliente ja pode revisar o resultado e o booster pode seguir o fluxo financeiro.',
                actionUrl: $this->frontendUrl('/orders'),
                context: [
                    'order_id' => $order->getKey(),
                    'route' => $this->routeLabel($order),
                    'customer' => $order->customer?->name,
                    'booster' => $order->booster?->name,
                    'discord_user_id' => $order->booster?->boosterProfile?->discord_user_id,
                    'discord_actions' => $this->completedOrderActions($order),
                ],
                channels: ['email'],
            ),
            $recipients,
        );
    }

    /**
     * @return Collection<int,User>
     */
    private function activeBoosters(): Collection
    {
        return User::query()
            ->where('role', UserRole::Booster->value)
            ->where('is_active', true)
            ->get();
    }

    private function routeLabel(ServiceOrder $order): string
    {
        $current = $this->currentRankLabel($order);
        $target = $this->desiredRankLabel($order);

        if (filled($current) && filled($target)) {
            return "{$current} -> {$target}";
        }

        $metadata = $order->metadata ?? [];

        if (is_string(data_get($metadata, 'quote_summary')) && filled(data_get($metadata, 'quote_summary'))) {
            return (string) data_get($metadata, 'quote_summary');
        }

        if (is_string(data_get($metadata, 'ladder_text')) && filled(data_get($metadata, 'ladder_text'))) {
            return (string) data_get($metadata, 'ladder_text');
        }

        return $order->title;
    }

    private function formatCents(int $amount): string
    {
        return Number::currency(((int) $amount) / 100, 'BRL', 'pt_BR');
    }

    /**
     * @return array<string,mixed>
     */
    private function availableOrderContext(ServiceOrder $order): array
    {
        $totalCents = $this->payouts->totalCents($order);

        return [
            'order_id' => '#'.$order->getKey(),
            'service' => $this->serviceLabel($order),
            'game' => $this->gameLabel($order),
            'queue' => $this->queueLabel($order),
            'current_rank' => $this->currentRankLabel($order),
            'desired_rank' => $this->desiredRankLabel($order),
            'preferred_routes' => $this->preferredRoutesLabel($order),
            'region' => $this->regionLabel($order),
            'total_price' => $this->formatCents($totalCents),
            'booster_value' => $this->formatCents($this->payouts->payoutCents($order)),
            'restrictions' => $this->restrictionsLabel($order),
            'status' => 'Disponivel para boosters',
            'mention_boosters' => true,
            'discord_deduplication_key' => 'order:'.$order->getKey(),
            'discord_actions' => $this->availableOrderActions($order),
        ];
    }

    private function serviceLabel(ServiceOrder $order): string
    {
        return match ($order->service_type) {
            'solo_boost_division' => 'Boost Solo - Divisao',
            'duo_boost_division' => 'Boost Duo - Divisao',
            'flex_boost_division' => 'Boost Flex - Divisao',
            'wins_by_rank' => 'Vitorias por elo',
            'md5_package' => 'MD5',
            'coaching_hour' => 'Coaching',
            default => $this->humanLabel($order->service_type ?: $order->title),
        };
    }

    private function gameLabel(ServiceOrder $order): string
    {
        $game = data_get($order->metadata ?? [], 'game');

        if (! is_string($game) || trim($game) === '') {
            return 'Nao informado';
        }

        return match ($game) {
            'lol' => 'League of Legends',
            'wild_rift' => 'Wild Rift',
            'tft' => 'Teamfight Tactics',
            default => $this->humanLabel($game),
        };
    }

    private function queueLabel(ServiceOrder $order): string
    {
        $metadataQueue = data_get($order->metadata ?? [], 'queue') ?? data_get($order->metadata ?? [], 'fila');

        if (is_string($metadataQueue) && trim($metadataQueue) !== '') {
            return $this->humanLabel($metadataQueue);
        }

        return match ($order->service_type) {
            'solo_boost_division', 'duo_boost_division', 'wins_by_rank' => 'Solo/Duo',
            'flex_boost_division' => 'Flex',
            'md5_package' => 'MD5',
            'coaching_hour' => 'Coaching',
            default => 'Nao informado',
        };
    }

    private function regionLabel(ServiceOrder $order): string
    {
        $metadata = $order->metadata ?? [];
        $region = data_get($metadata, 'region') ?? data_get($metadata, 'server') ?? data_get($metadata, 'riot_region');

        return is_string($region) && trim($region) !== '' ? strtoupper(trim($region)) : 'Nao informado';
    }

    private function rankLabel(mixed $explicitRank, mixed $tier, mixed $division): ?string
    {
        if (is_string($explicitRank) && trim($explicitRank) !== '') {
            return trim($explicitRank);
        }

        if (! is_string($tier) || trim($tier) === '') {
            return null;
        }

        $tierLabel = match (strtolower(trim($tier))) {
            'iron' => 'Ferro',
            'bronze' => 'Bronze',
            'silver' => 'Prata',
            'gold' => 'Ouro',
            'platinum' => 'Platina',
            'emerald' => 'Esmeralda',
            'diamond' => 'Diamante',
            'master' => 'Mestre',
            'grandmaster' => 'Grao-Mestre',
            'challenger' => 'Desafiante',
            'sovereign' => 'Soberano',
            default => $this->humanLabel($tier),
        };

        if (! is_string($division) || trim($division) === '') {
            return $tierLabel;
        }

        return $tierLabel.' '.strtoupper(trim($division));
    }

    private function currentRankLabel(ServiceOrder $order): ?string
    {
        $metadata = $order->metadata ?? [];

        return $this->rankLabel(
            data_get($metadata, 'current_rank') ?? data_get($metadata, 'currentRank'),
            data_get($metadata, 'current_tier'),
            data_get($metadata, 'current_division'),
        );
    }

    private function desiredRankLabel(ServiceOrder $order): ?string
    {
        $metadata = $order->metadata ?? [];

        return $this->rankLabel(
            data_get($metadata, 'desired_rank') ?? data_get($metadata, 'desiredRank'),
            data_get($metadata, 'target_tier'),
            data_get($metadata, 'target_division'),
        );
    }

    private function preferredRoutesLabel(ServiceOrder $order): string
    {
        $routes = data_get($order->metadata ?? [], 'addons.specific_routes');

        if (! is_array($routes)) {
            return 'Sem preferencia';
        }

        $routes = array_values(array_unique(array_filter(array_map(
            static fn ($route): string => trim((string) $route),
            $routes,
        ))));

        return $routes === [] ? 'Sem preferencia' : implode(', ', $routes);
    }

    private function restrictionsLabel(ServiceOrder $order): string
    {
        $addons = data_get($order->metadata ?? [], 'addons');

        if (! is_array($addons)) {
            return 'Nenhuma informada';
        }

        $restrictions = [];
        $mmrProfile = $addons['mmr_profile'] ?? null;
        if (is_string($mmrProfile) && ! in_array($mmrProfile, ['', 'none'], true)) {
            $restrictions[] = 'Perfil MMR: '.$this->humanLabel($mmrProfile);
        }

        if (($addons['chat_offline'] ?? false) === true) {
            $restrictions[] = 'Chat offline';
        }

        if (is_string($addons['flash_position'] ?? null) && trim((string) $addons['flash_position']) !== '') {
            $restrictions[] = 'Flash no '.strtoupper(trim((string) $addons['flash_position']));
        }

        if (($addons['priority_service'] ?? false) === true) {
            $restrictions[] = 'Servico prioritario';
        }

        if (($addons['super_restriction'] ?? false) === true) {
            $restrictions[] = 'Super restricao';
        }

        if (($addons['extra_win'] ?? false) === true) {
            $restrictions[] = 'Vitoria extra';
        }

        $this->appendListRestriction($restrictions, 'Campeoes especificos', $addons['specific_champions'] ?? null);

        if (is_string($addons['restricted_hours'] ?? null) && trim((string) $addons['restricted_hours']) !== '') {
            $restrictions[] = 'Horario disponivel: '.trim((string) $addons['restricted_hours']);
        }

        if (($addons['stream_online'] ?? false) === true) {
            $restrictions[] = 'Stream online';
        }

        if (($addons['reduce_kda'] ?? false) === true) {
            $restrictions[] = 'Reduzir KDA';
        }

        if (($addons['reduce_delivery'] ?? false) === true) {
            $restrictions[] = 'Prazo reduzido';
        }

        if (($addons['solo_only'] ?? false) === true) {
            $restrictions[] = 'Apenas solo';
        }

        return $restrictions === [] ? 'Nenhuma informada' : implode("\n", $restrictions);
    }

    /**
     * @param array<int,string> $restrictions
     */
    private function appendListRestriction(array &$restrictions, string $label, mixed $value): void
    {
        if (! is_array($value)) {
            return;
        }

        $items = array_values(array_filter(array_map(
            static fn ($item): string => trim((string) $item),
            $value,
        )));

        if ($items !== []) {
            $restrictions[] = $label.': '.implode(', ', $items);
        }
    }

    private function humanLabel(string $value): string
    {
        $normalized = str_replace(['_', '-'], ' ', trim($value));

        return ucwords(strtolower($normalized));
    }

    private function frontendUrl(string $path): string
    {
        return rtrim((string) config('notifications.frontend_url'), '/').$path;
    }

    /**
     * @return array<int,array{label:string,url:string}>
     */
    private function availableOrderActions(ServiceOrder $order): array
    {
        $orderPath = '/booster/orders/'.$order->getKey();

        return [
            ['label' => 'Pegar serviço', 'url' => $this->frontendUrl($orderPath.'?source=discord&action=claim')],
        ];
    }

    /**
     * @return array<int,array{label:string,url:string}>
     */
    private function assignedOrderActions(ServiceOrder $order): array
    {
        $orderPath = '/booster/orders/'.$order->getKey();

        return [
            ['label' => 'Ver pedido', 'url' => $this->frontendUrl($orderPath.'?source=discord')],
            ['label' => 'Baixar Tracker', 'url' => $this->frontendUrl($orderPath.'?source=discord&tracker=1')],
            ['label' => 'Abrir dashboard', 'url' => $this->frontendUrl('/dashboard?source=discord')],
        ];
    }

    /**
     * @return array<int,array{label:string,url:string}>
     */
    private function completedOrderActions(ServiceOrder $order): array
    {
        return [
            ['label' => 'Ver pedido', 'url' => $this->frontendUrl('/booster/orders/'.$order->getKey().'?source=discord')],
            ['label' => 'Abrir dashboard', 'url' => $this->frontendUrl('/dashboard?source=discord')],
        ];
    }
}
