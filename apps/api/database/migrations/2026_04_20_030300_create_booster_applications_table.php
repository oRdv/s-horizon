<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booster_applications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status')->default('pending')->index();
            $table->string('full_name');
            $table->date('birth_date');
            $table->unsignedTinyInteger('age');
            $table->string('cpf', 20);
            $table->string('pix_key');
            $table->string('gender');
            $table->string('in_game_nick');
            $table->string('highest_rank');
            $table->string('previous_season_rank');
            $table->text('available_hours');
            $table->string('location');
            $table->boolean('accepts_riot_responsibility')->default(false);
            $table->boolean('accepts_confidentiality_terms')->default(false);
            $table->decimal('initial_percentage', 5, 2)->default(65);
            $table->boolean('accepts_initial_percentage')->default(false);
            $table->string('opgg_url');
            $table->string('discord_username');
            $table->string('diamond_plus_eta');
            $table->boolean('accepts_cashflow_decay')->default(false);
            $table->text('review_notes')->nullable();
            $table->timestamp('submitted_at');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booster_applications');
    }
};
