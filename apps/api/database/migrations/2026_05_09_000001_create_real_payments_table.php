<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_orders', function (Blueprint $table): void {
            $table->unsignedBigInteger('base_price')->nullable()->after('price');
            $table->unsignedBigInteger('final_price')->nullable()->after('base_price');
            $table->string('payment_method')->nullable()->after('final_price');
            $table->string('payment_status')->nullable()->after('payment_method');
        });

        Schema::create('payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained('service_orders')->cascadeOnDelete();
            $table->unsignedBigInteger('boost_id')->index();
            $table->string('provider');
            $table->string('method');
            $table->string('status')->index();
            $table->unsignedBigInteger('amount');
            $table->unsignedBigInteger('base_amount');
            $table->unsignedBigInteger('fee_amount')->default(0);
            $table->unsignedBigInteger('discount_amount')->default(0);
            $table->unsignedBigInteger('final_amount');
            $table->string('currency', 3)->default('BRL');
            $table->unsignedTinyInteger('installments')->nullable();
            $table->string('provider_payment_id')->nullable()->index();
            $table->string('provider_preference_id')->nullable()->index();
            $table->string('provider_session_id')->nullable()->index();
            $table->string('payment_intent_id')->nullable()->index();
            $table->string('client_secret_last4_hash')->nullable();
            $table->text('qr_code')->nullable();
            $table->longText('qr_code_base64')->nullable();
            $table->text('pix_copy_paste')->nullable();
            $table->string('customer_email')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_payment_id']);
            $table->unique(['provider', 'provider_session_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');

        Schema::table('service_orders', function (Blueprint $table): void {
            $table->dropColumn([
                'base_price',
                'final_price',
                'payment_method',
                'payment_status',
            ]);
        });
    }
};
