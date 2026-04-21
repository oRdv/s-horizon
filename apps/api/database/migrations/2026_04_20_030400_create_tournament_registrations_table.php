<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tournament_registrations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('game')->index();
            $table->string('category_id')->index();
            $table->string('category_title');
            $table->string('status')->default('pending')->index();
            $table->string('team_name');
            $table->string('team_tag', 20);
            $table->string('captain_name');
            $table->string('captain_email');
            $table->string('captain_phone')->nullable();
            $table->string('captain_discord');
            $table->string('server', 80);
            $table->string('team_discord')->nullable();
            $table->string('how_found')->nullable();
            $table->json('roster');
            $table->text('notes')->nullable();
            $table->boolean('accepted_rules')->default(false);
            $table->boolean('accepted_check_in')->default(false);
            $table->timestamp('submitted_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tournament_registrations');
    }
};
