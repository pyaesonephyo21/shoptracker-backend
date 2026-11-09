<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('shops', function (Blueprint $table): void {
            $table->string('telegram_chat_id')->nullable()->index()->after('currency_code');
            $table->string('telegram_bot_token')->nullable()->after('telegram_chat_id');
            $table->string('telegram_webhook_secret')->nullable()->after('telegram_bot_token');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shops', function (Blueprint $table): void {
            $table->dropIndex(['telegram_chat_id']);
            $table->dropColumn(['telegram_chat_id', 'telegram_bot_token', 'telegram_webhook_secret']);
        });
    }
};
