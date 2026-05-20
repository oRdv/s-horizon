<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $mockEmails = [
            'mock.booster@horizonboost.com.br',
            'mock.cliente@horizonboost.com.br',
            'booster.mock@horizonboost.gg',
            'cliente.mock@horizonboost.gg',
        ];

        DB::transaction(function () use ($mockEmails): void {
            $mockUserIds = DB::table('users')
                ->whereIn('email', $mockEmails)
                ->orWhere('email', 'like', 'mock.%@horizonboost.%')
                ->orWhere('email', 'like', '%.mock@horizonboost.%')
                ->pluck('id')
                ->all();

            $mockOrderIds = DB::table('service_orders')
                ->whereIn('customer_id', $mockUserIds)
                ->orWhereIn('booster_id', $mockUserIds)
                ->orWhere('title', 'Mock LoL Solo Boost Prata IV para Ouro IV')
                ->pluck('id')
                ->all();

            if ($mockOrderIds !== []) {
                $conversationIds = DB::table('order_conversations')
                    ->whereIn('service_order_id', $mockOrderIds)
                    ->pluck('id')
                    ->all();

                if ($conversationIds !== []) {
                    DB::table('order_chat_messages')
                        ->whereIn('order_conversation_id', $conversationIds)
                        ->delete();
                }

                DB::table('order_conversations')
                    ->whereIn('service_order_id', $mockOrderIds)
                    ->delete();

                if (Schema::hasTable('payments')) {
                    DB::table('payments')
                        ->whereIn('order_id', $mockOrderIds)
                        ->delete();
                }

                if (Schema::hasTable('payment_transactions')) {
                    DB::table('payment_transactions')
                        ->whereIn('service_order_id', $mockOrderIds)
                        ->delete();
                }

                DB::table('service_orders')
                    ->whereIn('id', $mockOrderIds)
                    ->delete();
            }

            if ($mockUserIds !== []) {
                foreach ([
                    'booster_profiles',
                    'booster_riot_accounts',
                    'booster_tracker_sessions',
                    'booster_applications',
                    'tracked_matches',
                    'refresh_tokens',
                    'account_security_tokens',
                    'withdrawal_requests',
                ] as $table) {
                    if (Schema::hasTable($table)) {
                        $column = match ($table) {
                            'booster_profiles', 'booster_applications', 'refresh_tokens', 'account_security_tokens' => 'user_id',
                            'booster_riot_accounts', 'booster_tracker_sessions', 'tracked_matches' => 'booster_id',
                            'withdrawal_requests' => 'booster_id',
                            default => 'user_id',
                        };

                        DB::table($table)
                            ->whereIn($column, $mockUserIds)
                            ->delete();
                    }
                }

                if (Schema::hasTable('landing_boosters')) {
                    DB::table('landing_boosters')
                        ->whereIn('user_id', $mockUserIds)
                        ->delete();
                }

                if (Schema::hasTable('account_audit_logs')) {
                    DB::table('account_audit_logs')
                        ->whereIn('user_id', $mockUserIds)
                        ->orWhereIn('actor_id', $mockUserIds)
                        ->delete();
                }

                DB::table('users')
                    ->whereIn('id', $mockUserIds)
                    ->delete();
            }
        });
    }

    public function down(): void
    {
        // Legacy mock seed data must not be restored.
    }
};
