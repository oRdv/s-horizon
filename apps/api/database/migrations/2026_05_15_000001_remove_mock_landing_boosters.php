<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('landing_boosters')) {
            return;
        }

        DB::table('landing_boosters')
            ->whereNull('user_id')
            ->whereIn('nick', [
                'Viego',
                'Pyke',
                'Gragas',
                'Vex',
                'Naafiri',
                'Voliber',
                'Talon',
                'Vayne',
                'Jinx',
                'Twitch',
                'Udyr',
                "Kog'Maw",
                'Akshan',
            ])
            ->delete();
    }

    public function down(): void
    {
        //
    }
};
