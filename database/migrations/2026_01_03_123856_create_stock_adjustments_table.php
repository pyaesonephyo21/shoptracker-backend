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
        Schema::create('stock_adjustments', function (Blueprint $table) {
            $table->id();

            // 1. Shop FK (Explicitly named 'adj_shop_fk' to avoid collision)
            $table->unsignedBigInteger('shop_id');
            $table->foreign('shop_id', 'adj_shop_fk')
                ->references('id')->on('shops')
                ->onDelete('cascade');

            // 2. Product FK ('adj_prod_fk')
            $table->unsignedBigInteger('product_id');
            $table->foreign('product_id', 'adj_prod_fk')
                ->references('id')->on('products')
                ->onDelete('cascade');

            // 3. User FK ('adj_user_fk') - Who made the mistake?
            $table->unsignedBigInteger('user_id');
            $table->foreign('user_id', 'adj_user_fk')
                ->references('id')->on('users')
                ->onDelete('cascade');

            // Data columns
            $table->integer('quantity'); // Can be +1 or -1
            $table->string('reason');    // 'damage', 'loss', 'return'
            $table->text('note')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_adjustments');
    }
};
