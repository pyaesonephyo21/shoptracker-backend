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
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained()->onDelete('cascade')->index();
            $table->string('name');
            $table->string('sku')->nullable()->index(); // Good for barcode scanning later

            // 3. THE LOGIC ROUTER
            // 'local' = Local stock
            // 'global' = Foreign stock
            $table->string('type')->default('local');

            // 4. MONEY (Always use Decimal for currency!)
            // base_cost: What you pay (or owe Sister).
            $table->decimal('base_cost', 12, 2)->default(0);
            // retail_price: What you sell for.
            $table->decimal('retail_price', 12, 2)->default(0);

            // --- INVENTORY COLUMNS ---
            $table->integer('stock_quantity')->default(0); // "Real" stock (In your room)
            $table->integer('pending_stock')->default(0);  // "Virtual" stock (In the truck)

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
