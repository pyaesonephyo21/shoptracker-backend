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
            $table->string('type')->default('local');
            $table->decimal('base_cost', 12, 2)->default(0);
            $table->decimal('retail_price', 12, 2)->default(0);
            $table->json('variant_options')->nullable(); // e.g. [{"name": "Color", "values": ["Red", "Blue"]}]

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
