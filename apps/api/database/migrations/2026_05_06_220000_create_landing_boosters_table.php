<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('landing_boosters', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('nick');
            $table->string('champion_name');
            $table->string('rank_label');
            $table->string('rank_key');
            $table->string('game')->default('League of Legends');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        $boosters = [
            ['nick' => 'Viego', 'champion_name' => 'Viego', 'rank_label' => 'Grão-Mestre', 'rank_key' => 'grandmaster', 'sort_order' => 1, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => 'Pyke', 'champion_name' => 'Pyke', 'rank_label' => 'Grão-Mestre I', 'rank_key' => 'grandmaster', 'game' => 'Wild Rift', 'sort_order' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => 'Gragas', 'champion_name' => 'Gragas', 'rank_label' => 'Grão-Mestre', 'rank_key' => 'grandmaster', 'sort_order' => 3, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => 'Vex', 'champion_name' => 'Vex', 'rank_label' => 'Diamante I', 'rank_key' => 'diamond', 'sort_order' => 4, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => 'Naafiri', 'champion_name' => 'Naafiri', 'rank_label' => 'Diamante II', 'rank_key' => 'diamond', 'sort_order' => 5, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => 'Voliber', 'champion_name' => 'Volibear', 'rank_label' => 'Mestre', 'rank_key' => 'master', 'sort_order' => 6, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => 'Talon', 'champion_name' => 'Talon', 'rank_label' => 'Mestre', 'rank_key' => 'master', 'sort_order' => 7, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => 'Vayne', 'champion_name' => 'Vayne', 'rank_label' => 'Mestre', 'rank_key' => 'master', 'sort_order' => 8, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => 'Jinx', 'champion_name' => 'Jinx', 'rank_label' => 'Grão-Mestre', 'rank_key' => 'grandmaster', 'sort_order' => 9, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => 'Twitch', 'champion_name' => 'Twitch', 'rank_label' => 'Mestre', 'rank_key' => 'master', 'sort_order' => 10, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => 'Udyr', 'champion_name' => 'Udyr', 'rank_label' => 'Desafiante', 'rank_key' => 'challenger', 'sort_order' => 11, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => "Kog'Maw", 'champion_name' => "Kog'Maw", 'rank_label' => 'Grão-Mestre', 'rank_key' => 'grandmaster', 'sort_order' => 12, 'created_at' => now(), 'updated_at' => now()],
            ['nick' => 'Akshan', 'champion_name' => 'Akshan', 'rank_label' => 'Grão-Mestre', 'rank_key' => 'grandmaster', 'sort_order' => 13, 'created_at' => now(), 'updated_at' => now()],
        ];

        foreach ($boosters as $booster) {
            DB::table('landing_boosters')->insert([
                'game' => 'League of Legends',
                ...$booster,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('landing_boosters');
    }
};
