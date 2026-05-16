<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        DB::table('users')
            ->whereIn('email', [
                'raven.booster@horizonboost.gg',
                'akali.booster@horizonboost.gg',
                'viego.booster@horizonboost.gg',
                'lux.booster@horizonboost.gg',
                'cliente.mock@horizonboost.gg',
            ])
            ->delete();
    }

    public function down(): void
    {
        //
    }
};
