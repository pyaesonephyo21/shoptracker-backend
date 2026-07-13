<?php

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
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->decimal('allocated_cargo_fee', 12, 2)->nullable()->after('line_total');
            $table->decimal('allocated_adjustment_amount', 12, 2)->nullable()->after('allocated_cargo_fee');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('purchase_order_items', function (Blueprint $table) {
            $table->dropColumn(['allocated_cargo_fee', 'allocated_adjustment_amount']);
        });
    }
};
