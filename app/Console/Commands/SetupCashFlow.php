<?php

namespace App\Console\Commands;

use App\Models\Expense;
use App\Models\PurchaseOrder;
use App\Models\SalesOrder;
use App\Models\SalesOrderPayment;
use App\Services\CashFlowService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SetupCashFlow extends Command
{
    protected $signature = 'app:setup-cash-flow';

    protected $description = 'Backfill cash transactions for existing data.';

    public function handle(CashFlowService $cashFlowService)
    {
        $this->info('Running database migrations...');
        $this->call('migrate', ['--force' => true]);

        $this->info('Backfilling cash transactions...');

        DB::transaction(function () use ($cashFlowService) {
            // 1. Clear existing transactions to avoid duplicates if run multiple times
            DB::table('cash_transactions')->truncate();

            // 2. Backfill SalesOrderPayments
            $payments = SalesOrderPayment::with('salesOrder')->get();
            $this->info("Found {$payments->count()} sales order payments.");

            foreach ($payments as $payment) {
                if ($payment->salesOrder && $payment->amount > 0) {
                    $cashFlowService->recordInflow(
                        $payment->salesOrder->shop_id,
                        $payment->amount,
                        'sale',
                        "Payment for Order #{$payment->salesOrder->id}",
                        SalesOrder::class,
                        $payment->salesOrder->id
                    );
                }
            }

            // 3. Backfill Expenses
            $expenses = Expense::all();
            $this->info("Found {$expenses->count()} expenses.");

            foreach ($expenses as $expense) {
                if ($expense->amount > 0) {
                    $cashFlowService->recordOutflow(
                        $expense->shop_id,
                        $expense->amount,
                        'expense',
                        $expense->title,
                        Expense::class,
                        $expense->id
                    );
                }
            }

            // 4. Backfill Purchase Orders
            $pos = PurchaseOrder::where('paid_amount', '>', 0)->get();
            $this->info("Found {$pos->count()} purchase orders with payments.");

            foreach ($pos as $po) {
                if ($po->paid_amount > 0) {
                    $cashFlowService->recordOutflow(
                        $po->shop_id,
                        $po->paid_amount,
                        'purchase',
                        "Payment for PO {$po->batch_name}",
                        PurchaseOrder::class,
                        $po->id
                    );
                }
            }
        });

        $this->info('Cash transactions backfilled successfully.');
    }
}
