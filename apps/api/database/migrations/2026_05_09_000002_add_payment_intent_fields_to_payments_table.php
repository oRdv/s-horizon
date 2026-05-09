<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            if (! Schema::hasColumn('payments', 'payment_intent_id')) {
                $table->string('payment_intent_id')->nullable()->index()->after('provider_session_id');
            }

            if (! Schema::hasColumn('payments', 'client_secret_last4_hash')) {
                $table->string('client_secret_last4_hash')->nullable()->after('payment_intent_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table): void {
            if (Schema::hasColumn('payments', 'client_secret_last4_hash')) {
                $table->dropColumn('client_secret_last4_hash');
            }

            if (Schema::hasColumn('payments', 'payment_intent_id')) {
                $table->dropColumn('payment_intent_id');
            }
        });
    }
};
