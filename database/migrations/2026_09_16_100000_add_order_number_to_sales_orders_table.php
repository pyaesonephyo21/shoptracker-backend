<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->unsignedBigInteger('order_number')->nullable()->after('shop_id');
        });

        // Backfill existing orders sequentially per shop
        $shops = DB::table('shops')->pluck('id');
        foreach ($shops as $shopId) {
            $orders = DB::table('sales_orders')
                ->where('shop_id', $shopId)
                ->orderBy('created_at', 'asc')
                ->orderBy('id', 'asc')
                ->get(['id']);

            $seq = 1;
            foreach ($orders as $order) {
                DB::table('sales_orders')
                    ->where('id', $order->id)
                    ->update(['order_number' => $seq++]);
            }
        }

        Schema::table('sales_orders', function (Blueprint $table) {
            $table->unique(['shop_id', 'order_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropUnique(['shop_id', 'order_number']);
            $table->dropColumn('order_number');
        });
    }
};

