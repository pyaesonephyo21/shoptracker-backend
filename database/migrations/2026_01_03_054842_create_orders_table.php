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
        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('shop_id');
            // We manually name the index 'orders_shop_id_foreign' to avoid conflicts
            $table->foreign('shop_id', 'orders_shop_fk') // We name the Index 'orders_shop_fk'
                ->references('id')
                ->on('shops')
                ->onDelete('cascade');

            // CUSTOMER INFO
            $table->string('customer_name');
            $table->string('customer_phone')->nullable();
            $table->text('delivery_address')->nullable();

            // MONEY (The "Sales" Side)
            $table->decimal('total_amount', 12, 2)->default(0);    // e.g. 15,000
            $table->decimal('prepaid_amount', 12, 2)->default(0);  // e.g. 5,000
            // 'virtualAs' auto-calculates this in the database!
            $table->decimal('remaining_amount', 12, 2)->virtualAs('total_amount - prepaid_amount');

            // STATUSES
            // Payment: 'unpaid', 'partial', 'paid'
            $table->string('payment_status')->default('unpaid')->index();
            // Fulfillment: 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'returned', 'cancelled'
            $table->string('status')->default('pending')->index();

            $table->text('note')->nullable(); // "Customer wants delivery after 5pm"

            $table->timestamps();
        });

        // We also need the "Order Items" table to know WHAT they bought
        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->onDelete('cascade');
            $table->foreignId('product_variant_id')->constrained('product_variants')->cascadeOnDelete();

            $table->integer('quantity');

            // SNAPSHOT PRICES (Crucial!)
            // We save the price *at the moment of sale* because prices change later.
            $table->decimal('unit_price', 12, 2); // Retail Price
            $table->decimal('unit_cost', 12, 2)->nullable(); // Cost Price (for profit calc)
            $table->decimal('subtotal', 12, 2); // quantity * unit_price

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
        Schema::dropIfExists('order_items');
    }
};
