<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_conversations', function (Blueprint $table): void {
            if (! Schema::hasColumn('order_conversations', 'pinned_message_id')) {
                $table->foreignId('pinned_message_id')
                    ->nullable()
                    ->after('last_message_at')
                    ->constrained('order_chat_messages')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_conversations', function (Blueprint $table): void {
            if (Schema::hasColumn('order_conversations', 'pinned_message_id')) {
                $table->dropConstrainedForeignId('pinned_message_id');
            }
        });
    }
};
