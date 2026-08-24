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
        Schema::create('product_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->onDelete('cascade')->index();
            $table->string('sku')->nullable()->index();

            // JSON attributes for dynamic variants (e.g. {"Color": "Red", "Size": "L", "Storage": "64GB"})
            $table->json('attributes')->nullable();

            // Stock is tracked at the variant level
            $table->integer('stock_quantity')->default(0);
            $table->integer('pending_stock')->default(0);

            // Optional price override for specific variants (e.g., XXL costs more)
            $table->decimal('retail_price', 12, 2)->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_variants');
    }
};
