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
        Schema::create('sales_orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('shop_id');
            $table->foreign('shop_id', 'so_shop_fk')->references('id')->on('shops')->onDelete('cascade');

            $table->unsignedBigInteger('courier_id')->nullable();
            $table->foreign('courier_id', 'so_cour_fk')->references('id')->on('couriers')->onDelete('set null');

            // --- CUSTOMER DETAILS (Updated) ---
            $table->string('customer_name')->nullable();
            $table->string('customer_phone')->nullable();
            $table->text('delivery_address')->nullable();

            // Logistics
            $table->string('tracking_number')->nullable();

            // Logic Change: Default to 'pending' as discussed
            $table->string('status')->default('pending');
            $table->string('payment_method')->default('kpay');

            // Financials
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('delivery_fee', 12, 2)->default(0);
            $table->decimal('courier_service_fee', 12, 2)->default(0);
            $table->boolean('is_deli_prepaid')->default(false);

            // Logic: Default to 'courier' if that's your preferred flow
            $table->string('money_collected_by')->default('courier');

            // Totals
            $table->decimal('customer_grand_total', 12, 2)->default(0);
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->string('payment_status')->default('unpaid');

            $table->decimal('net_revenue', 12, 2)->default(0);
            $table->string('settlement_status')->default('unpaid');

            // Profit & Cost
            $table->decimal('total_cost', 12, 2)->default(0);
            $table->decimal('net_profit', 12, 2)->default(0);
            $table->decimal('return_cost', 12, 2)->default(0);

            // Discount
            $table->string('discount_type')->default('none');
            $table->decimal('discount_value', 10, 2)->default(0);
            $table->decimal('discount_total', 12, 2)->default(0);
            $table->string('discount_reason')->nullable();

            $table->boolean('is_preorder')->default(false);
            $table->text('note')->nullable();
            $table->json('audit_log')->nullable();
            $table->timestamps();
        });

        // Items table (Unchanged)
        Schema::create('sales_order_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('sales_order_id');
            $table->foreign('sales_order_id', 'so_items_order_fk')->references('id')->on('sales_orders')->onDelete('cascade');
            $table->unsignedBigInteger('product_id');
            $table->foreign('product_id', 'so_items_prod_fk')->references('id')->on('products')->onDelete('cascade');
            $table->integer('quantity');
            $table->decimal('unit_price', 12, 2);
            $table->decimal('line_total', 12, 2);
            $table->decimal('unit_cost', 12, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sales_order_items');
        Schema::dropIfExists('sales_orders');
    }
};
