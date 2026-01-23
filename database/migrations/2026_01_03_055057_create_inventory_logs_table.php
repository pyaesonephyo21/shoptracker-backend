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
        Schema::create('inventory_logs', function (Blueprint $table) {
            $table->id();
            // 1. Explicitly name the Shop FK
            $table->unsignedBigInteger('shop_id');
            $table->foreign('shop_id', 'inv_logs_shop_fk')->references('id')->on('shops')->onDelete('cascade');

            // 2. Explicitly name the Product FK
            $table->unsignedBigInteger('product_id');
            $table->foreign('product_id', 'inv_logs_prod_fk')->references('id')->on('products')->onDelete('cascade');

            // THE CHANGE
            // e.g. +10 (Arrived), -1 (Sold), -1 (Damage), +1 (Return)
            $table->integer('quantity_change');

            // THE RESULT
            // What was the total stock *after* this happened?
            $table->integer('new_stock_level');

            // THE REASON
            // 'sale', 'purchase', 'return', 'damage', 'manual_adjustment'
            $table->string('reason');

            // THE LINK (Polymorphic Relation)
            // This lets us link to an 'Order' OR a 'PurchaseOrder'
            // It creates: reference_type (e.g., App\Models\Order) and reference_id (e.g., 55)
            $table->nullableMorphs('reference');

            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_logs');
    }
};
