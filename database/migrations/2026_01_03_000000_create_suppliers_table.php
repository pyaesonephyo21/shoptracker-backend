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
        Schema::create('suppliers', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('shop_id');
            $table->foreign('shop_id', 'supp_shop_fk')->references('id')->on('shops')->onDelete('cascade');

            $table->string('name'); // e.g., "Guangzhou Agent A", "Local Wholesaler"
            $table->string('type'); // 'foreign' or 'local'
            $table->string('currency')->default('MMK'); // 'MMK', 'CNY', 'THB'

            $table->string('contact_info')->nullable(); // Phone/WeChat
            $table->text('address')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('suppliers');
    }
};
