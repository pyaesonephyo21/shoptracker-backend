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
        Schema::table('sales_order_items', function (Blueprint $table) {
            $table->string('discount_type')->default('none')->after('quantity'); // fixed/percent
            $table->decimal('discount_value', 12, 2)->default(0)->after('discount_type');
            $table->decimal('discount_amount', 12, 2)->default(0)->after('discount_value'); // The actual money deducted
            $table->string('discount_reason')->nullable()->after('discount_amount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_order_items', function (Blueprint $table) {
            //
        });
    }
};
