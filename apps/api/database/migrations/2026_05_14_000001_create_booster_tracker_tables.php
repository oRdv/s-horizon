<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booster_riot_accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('booster_id')->constrained('users')->cascadeOnDelete();
            $table->string('puuid')->nullable()->index();
            $table->string('game_name')->nullable();
            $table->string('tag_line')->nullable();
            $table->string('summoner_name')->nullable();
            $table->string('region', 12)->default('BR1');
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->unique(['booster_id', 'puuid', 'region']);
        });

        Schema::create('booster_tracker_sessions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('booster_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('service_order_id')->nullable()->constrained('service_orders')->cascadeOnDelete();
            $table->string('status')->default('ONLINE')->index();
            $table->string('riot_puuid')->nullable()->index();
            $table->string('game_name')->nullable();
            $table->string('tag_line')->nullable();
            $table->string('summoner_name')->nullable();
            $table->string('region', 12)->default('BR1');
            $table->string('current_game_id')->nullable()->index();
            $table->integer('current_queue_id')->nullable();
            $table->integer('current_champion_id')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamp('last_heartbeat_at')->nullable()->index();
            $table->timestamps();

            $table->index(['booster_id', 'service_order_id']);
        });

        Schema::create('tracked_matches', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('service_order_id')->nullable()->constrained('service_orders')->cascadeOnDelete();
            $table->foreignId('booster_id')->constrained('users')->cascadeOnDelete();
            $table->string('riot_puuid')->nullable()->index();
            $table->string('match_id')->nullable()->index();
            $table->string('game_id')->nullable()->index();
            $table->integer('champion_id')->nullable();
            $table->integer('queue_id')->nullable();
            $table->string('result')->nullable();
            $table->integer('kills')->nullable();
            $table->integer('deaths')->nullable();
            $table->integer('assists')->nullable();
            $table->integer('lp_before')->nullable();
            $table->integer('lp_after')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->integer('duration_seconds')->nullable();
            $table->json('raw_data')->nullable();
            $table->timestamps();

            $table->unique(['booster_id', 'match_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracked_matches');
        Schema::dropIfExists('booster_tracker_sessions');
        Schema::dropIfExists('booster_riot_accounts');
    }
};
