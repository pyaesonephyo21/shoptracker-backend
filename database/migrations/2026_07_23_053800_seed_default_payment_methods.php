<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $shops = DB::table('shops')->get();
        
        foreach ($shops as $shop) {
            DB::table('payment_methods')->insert([
                [
                    'shop_id' => $shop->id,
                    'name' => 'Cash',
                    'code' => 'cash',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'shop_id' => $shop->id,
                    'name' => 'KBZPay',
                    'code' => 'kpay',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
                [
                    'shop_id' => $shop->id,
                    'name' => 'AYAPay',
                    'code' => 'ayapay',
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ],
            ]);
        }
    }

    public function down(): void
    {
        DB::table('payment_methods')->whereIn('code', ['cash', 'kpay', 'ayapay'])->delete();
    }
};
