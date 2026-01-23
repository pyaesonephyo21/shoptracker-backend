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
        Schema::create('couriers', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('shop_id');
            $table->foreign('shop_id', 'cour_shop_fk')->references('id')->on('shops')->onDelete('cascade');

            $table->string('name'); // "Royal Express", "Mandalay Gate"
            $table->string('contact_info')->nullable(); // "09..."

            $table->decimal('default_service_fee', 10, 2)->default(0);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('couriers');
    }
};
