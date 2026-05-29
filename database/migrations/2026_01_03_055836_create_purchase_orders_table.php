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
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();

            // 1. Shop Link
            $table->unsignedBigInteger('shop_id');
            $table->foreign('shop_id', 'po_shop_fk')->references('id')->on('shops')->onDelete('cascade');

            // 2. Supplier Link
            // It is nullable in case you buy something random without a saved supplier (Local Order)
            $table->unsignedBigInteger('supplier_id')->nullable();
            $table->foreign('supplier_id', 'po_supp_fk')->references('id')->on('suppliers')->onDelete('set null');

            $table->string('local_shop_name')->nullable(); // For local orders without a saved supplier

            $table->string('batch_name');
            $table->string('status')->default('pending'); // pending, arrived, cancelled

            // 3. Currency & Exchange Rate (Crucial for China orders)
            // If local, rate is 1.0000. If foreign, rate might be 500.0000
            $table->decimal('exchange_rate', 10, 4)->default(1);

            // 4. Cost Breakdown (The "Foreign Flow")
            // Stage 1: Paid Upfront
            $table->decimal('total_goods_cost', 12, 2)->default(0); // Calculated from items
            $table->decimal('supplier_fee', 12, 2)->default(0);     // Extra fee for the agent

            // Stage 2: Paid on Arrival
            $table->decimal('cargo_fee', 12, 2)->default(0);        // Shipping from China
            $table->decimal('local_deli_fee', 12, 2)->default(0);   // Delivery to warehouse
            $table->decimal('adjustment_amount', 12, 2)->default(0);
            $table->string('adjustment_reason')->nullable();

            // 5. Grand Total (Sum of everything * Exchange Rate)
            $table->decimal('grand_total', 12, 2)->default(0);

            // 6. Payment Status (New!)
            // 'unpaid', 'partial' (paid upfront only), 'paid' (fully settled)
            $table->string('payment_status')->default('unpaid');
            $table->decimal('paid_amount', 12, 2)->default(0); // How much have we actually paid?
            $table->string('cancel_reason')->nullable();

            $table->text('note')->nullable();
            $table->json('audit_log')->nullable();
            $table->timestamps();
        });

        // 2. THE ITEMS (What is inside the box)
        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_order_id');
            $table->foreign('purchase_order_id', 'po_items_po_fk')->references('id')->on('purchase_orders')->onDelete('cascade');

            // Explicit Product FK
            $table->unsignedBigInteger('product_id');
            $table->foreign('product_id', 'po_items_prod_fk')->references('id')->on('products');

            $table->integer('quantity');
            $table->integer('received_quantity')->nullable();

            $table->decimal('original_cost', 12, 2); // e.g., 30.00 (CNY)
            $table->decimal('unit_cost', 12, 2);     // e.g., 15000.00 (MMK) - Used for calculations

            $table->decimal('line_total', 12, 2);
            $table->decimal('retail_price', 15, 2)->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
        Schema::dropIfExists('purchase_order_items');
    }
};
