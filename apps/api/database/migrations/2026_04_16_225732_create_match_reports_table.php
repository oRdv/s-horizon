<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('match_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('external_match_id')->nullable();
            $table->string('result', 10);
            $table->unsignedInteger('duration_seconds');
            $table->timestamp('played_at');
            $table->string('source', 50)->default('desktop-app');
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'played_at']);
            $table->unique(['user_id', 'external_match_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('match_reports');
    }
};
