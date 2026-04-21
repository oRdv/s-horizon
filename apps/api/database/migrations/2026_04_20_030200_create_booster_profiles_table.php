<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booster_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->string('full_name')->nullable();
            $table->date('birth_date')->nullable();
            $table->unsignedTinyInteger('age')->nullable();
            $table->string('cpf', 20)->nullable();
            $table->string('pix_key')->nullable();
            $table->string('gender')->nullable();
            $table->string('in_game_nick')->nullable();
            $table->string('highest_rank')->nullable();
            $table->string('previous_season_rank')->nullable();
            $table->text('available_hours')->nullable();
            $table->string('location')->nullable();
            $table->boolean('accepts_riot_responsibility')->default(false);
            $table->boolean('accepts_confidentiality_terms')->default(false);
            $table->decimal('initial_percentage', 5, 2)->default(65);
            $table->boolean('accepts_initial_percentage')->default(false);
            $table->string('opgg_url')->nullable();
            $table->string('discord_username')->nullable();
            $table->string('diamond_plus_eta')->nullable();
            $table->boolean('accepts_cashflow_decay')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booster_profiles');
    }
};
