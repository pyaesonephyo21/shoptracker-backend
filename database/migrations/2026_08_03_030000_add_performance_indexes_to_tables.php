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
        // 1. Sales Orders Indexes
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->index(['shop_id', 'status', 'created_at'], 'idx_so_shop_status_created');
            $table->index(['shop_id', 'created_at'], 'idx_so_shop_created');
            $table->index('payment_status', 'idx_so_payment_status');
            $table->index('settlement_status', 'idx_so_settlement_status');
            $table->index('customer_name', 'idx_so_customer_name');
            $table->index('customer_phone', 'idx_so_customer_phone');
        });

        // 2. Purchase Orders Indexes
        if (Schema::hasTable('purchase_orders')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->index(['shop_id', 'status', 'created_at'], 'idx_po_shop_status_created');
            });
        }

        // 3. Cash Transactions Indexes
        if (Schema::hasTable('cash_transactions')) {
            Schema::table('cash_transactions', function (Blueprint $table) {
                $table->index(['shop_id', 'created_at'], 'idx_ct_shop_created');
                $table->index('type', 'idx_ct_type');
            });
        }

        // 4. Expenses Indexes
        if (Schema::hasTable('expenses')) {
            Schema::table('expenses', function (Blueprint $table) {
                $table->index(['shop_id', 'incurred_at'], 'idx_exp_shop_incurred');
            });
        }

        // 5. Product Variants Indexes
        if (Schema::hasTable('product_variants')) {
            Schema::table('product_variants', function (Blueprint $table) {
                $table->index(['product_id', 'deleted_at'], 'idx_pv_product_deleted');
            });
        }

        // 6. Sales Order Payments Indexes
        if (Schema::hasTable('sales_order_payments')) {
            Schema::table('sales_order_payments', function (Blueprint $table) {
                $table->index(['sales_order_id', 'created_at'], 'idx_sop_order_created');
                $table->index(['payment_method', 'created_at'], 'idx_sop_method_created');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropIndex('idx_so_shop_status_created');
            $table->dropIndex('idx_so_shop_created');
            $table->dropIndex('idx_so_payment_status');
            $table->dropIndex('idx_so_settlement_status');
            $table->dropIndex('idx_so_customer_name');
            $table->dropIndex('idx_so_customer_phone');
        });

        if (Schema::hasTable('purchase_orders')) {
            Schema::table('purchase_orders', function (Blueprint $table) {
                $table->dropIndex('idx_po_shop_status_created');
            });
        }

        if (Schema::hasTable('cash_transactions')) {
            Schema::table('cash_transactions', function (Blueprint $table) {
                $table->dropIndex('idx_ct_shop_created');
                $table->dropIndex('idx_ct_type');
            });
        }

        if (Schema::hasTable('expenses')) {
            Schema::table('expenses', function (Blueprint $table) {
                $table->dropIndex('idx_exp_shop_incurred');
            });
        }

        if (Schema::hasTable('product_variants')) {
            Schema::table('product_variants', function (Blueprint $table) {
                $table->dropIndex('idx_pv_product_deleted');
            });
        }

        if (Schema::hasTable('sales_order_payments')) {
            Schema::table('sales_order_payments', function (Blueprint $table) {
                $table->dropIndex('idx_sop_order_created');
                $table->dropIndex('idx_sop_method_created');
            });
        }
    }
};
