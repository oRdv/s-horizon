<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booster_profiles', function (Blueprint $table): void {
            $table->string('discord_user_id', 32)->nullable()->unique()->after('discord_username');
        });
    }

    public function down(): void
    {
        Schema::table('booster_profiles', function (Blueprint $table): void {
            $table->dropUnique(['discord_user_id']);
            $table->dropColumn('discord_user_id');
        });
    }
};
