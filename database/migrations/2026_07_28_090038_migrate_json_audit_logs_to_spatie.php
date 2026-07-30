<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Migrate Data for Sales Orders
        $salesOrders = DB::table('sales_orders')->whereNotNull('audit_log')->get();
        foreach ($salesOrders as $order) {
            $logs = json_decode($order->audit_log, true) ?? [];
            foreach ($logs as $log) {
                $activity = new \Spatie\Activitylog\Models\Activity();
                $activity->log_name = 'default';
                $activity->description = $log['action'] ?? 'Unknown Action';
                $activity->subject_type = \App\Models\SalesOrder::class;
                $activity->subject_id = $order->id;
                $activity->causer_type = null;
                $activity->causer_id = null;
                $activity->properties = [
                    'by' => $log['by'] ?? 'System',
                    'details' => $log['details'] ?? [],
                ];
                $activity->created_at = Carbon::parse($log['at'] ?? now());
                $activity->updated_at = Carbon::parse($log['at'] ?? now());
                $activity->save();
            }
        }

        // 2. Migrate Data for Purchase Orders
        $purchaseOrders = DB::table('purchase_orders')->whereNotNull('audit_log')->get();
        foreach ($purchaseOrders as $order) {
            $logs = json_decode($order->audit_log, true) ?? [];
            foreach ($logs as $log) {
                $activity = new \Spatie\Activitylog\Models\Activity();
                $activity->log_name = 'default';
                $activity->description = $log['action'] ?? 'Unknown Action';
                $activity->subject_type = \App\Models\PurchaseOrder::class;
                $activity->subject_id = $order->id;
                $activity->causer_type = null;
                $activity->causer_id = null;
                $activity->properties = [
                    'by' => $log['by'] ?? 'System',
                    'details' => $log['details'] ?? [],
                ];
                $activity->created_at = Carbon::parse($log['at'] ?? now());
                $activity->updated_at = Carbon::parse($log['at'] ?? now());
                $activity->save();
            }
        }

        // 3. Drop legacy columns
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->dropColumn('audit_log');
        });

        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->dropColumn('audit_log');
        });
    }

    public function down(): void
    {
        Schema::table('sales_orders', function (Blueprint $table) {
            $table->json('audit_log')->nullable();
        });
        
        Schema::table('purchase_orders', function (Blueprint $table) {
            $table->json('audit_log')->nullable();
        });
    }
};
