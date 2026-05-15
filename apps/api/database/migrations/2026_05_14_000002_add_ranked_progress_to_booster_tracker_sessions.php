<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booster_tracker_sessions', function (Blueprint $table): void {
            $table->json('ranked_snapshot')->nullable()->after('current_champion_id');
            $table->integer('lp_delta')->nullable()->after('ranked_snapshot');
            $table->decimal('progress_percent', 5, 2)->default(0)->after('lp_delta');
        });
    }

    public function down(): void
    {
        Schema::table('booster_tracker_sessions', function (Blueprint $table): void {
            $table->dropColumn(['ranked_snapshot', 'lp_delta', 'progress_percent']);
        });
    }
};
