<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('order_conversations', function (Blueprint $table): void {
            if (! Schema::hasColumn('order_conversations', 'status')) {
                $table->string('status')->default('ACTIVE')->after('booster_id')->index();
            }

            if (! Schema::hasColumn('order_conversations', 'last_message')) {
                $table->text('last_message')->nullable()->after('opened_at');
            }

            if (! Schema::hasColumn('order_conversations', 'last_message_at')) {
                $table->timestamp('last_message_at')->nullable()->after('last_message');
            }
        });

        Schema::table('order_chat_messages', function (Blueprint $table): void {
            if (! Schema::hasColumn('order_chat_messages', 'sender_type')) {
                $table->string('sender_type')->default('CLIENT')->after('sender_id')->index();
            }

            if (! Schema::hasColumn('order_chat_messages', 'is_read')) {
                $table->boolean('is_read')->default(false)->after('body')->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_chat_messages', function (Blueprint $table): void {
            if (Schema::hasColumn('order_chat_messages', 'is_read')) {
                $table->dropColumn('is_read');
            }

            if (Schema::hasColumn('order_chat_messages', 'sender_type')) {
                $table->dropColumn('sender_type');
            }
        });

        Schema::table('order_conversations', function (Blueprint $table): void {
            if (Schema::hasColumn('order_conversations', 'last_message_at')) {
                $table->dropColumn('last_message_at');
            }

            if (Schema::hasColumn('order_conversations', 'last_message')) {
                $table->dropColumn('last_message');
            }

            if (Schema::hasColumn('order_conversations', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};
