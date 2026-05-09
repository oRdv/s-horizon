<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_conversations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('service_order_id')->unique()->constrained('service_orders')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('booster_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('opened_at')->nullable();
            $table->timestamps();
        });

        Schema::create('order_chat_messages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_conversation_id')->constrained('order_conversations')->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_chat_messages');
        Schema::dropIfExists('order_conversations');
    }
};
