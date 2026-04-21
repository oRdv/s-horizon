<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('staff_profile')->nullable()->after('role');
            $table->json('permissions')->nullable()->after('staff_profile');
            $table->boolean('is_active')->default(true)->after('permissions');
            $table->boolean('two_factor_enabled')->default(false)->after('is_active');
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_enabled');
            $table->string('profile_photo_path')->nullable()->after('two_factor_confirmed_at');
            $table->timestamp('last_login_at')->nullable()->after('profile_photo_path');
            $table->timestamp('approved_at')->nullable()->after('last_login_at');
            $table->foreignId('approved_by')->nullable()->after('approved_at')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('approved_by');
            $table->dropColumn([
                'staff_profile',
                'permissions',
                'is_active',
                'two_factor_enabled',
                'two_factor_confirmed_at',
                'profile_photo_path',
                'last_login_at',
                'approved_at',
            ]);
        });
    }
};
