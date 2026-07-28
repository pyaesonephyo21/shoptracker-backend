<?php

namespace App\Services;

use App\Models\CashTransaction;
use Illuminate\Support\Facades\DB;

class CashFlowService
{
    /**
     * Record a cash inflow (e.g., from a sale or manual cash in).
     */
    public function recordInflow($shopId, $amount, $type, $description = null, $referenceType = null, $referenceId = null)
    {
        return CashTransaction::create([
            'shop_id' => $shopId,
            'amount' => abs($amount), // Ensure inflow is positive
            'type' => $type,
            'description' => $description,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
        ]);
    }

    /**
     * Record a cash outflow (e.g., from an expense, purchase order, or manual cash out).
     */
    public function recordOutflow($shopId, $amount, $type, $description = null, $referenceType = null, $referenceId = null)
    {
        return CashTransaction::create([
            'shop_id' => $shopId,
            'amount' => -abs($amount), // Ensure outflow is negative
            'type' => $type,
            'description' => $description,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
        ]);
    }

    /**
     * Update an existing transaction (e.g. when an expense changes)
     */
    public function updateTransaction($referenceType, $referenceId, $amount, $description = null)
    {
        $transaction = CashTransaction::where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->first();

        if ($transaction) {
            // Preserve the sign of the original transaction
            $isOutflow = $transaction->amount < 0;
            $transaction->amount = $isOutflow ? -abs($amount) : abs($amount);
            
            if ($description !== null) {
                $transaction->description = $description;
            }
            
            $transaction->save();
            return $transaction;
        }
        return null;
    }

    /**
     * Sync an outflow transaction (create, update, or delete based on amount)
     */
    public function syncOutflow($shopId, $amount, $type, $description, $referenceType, $referenceId)
    {
        if ((float)$amount <= 0) {
            $this->deleteTransaction($referenceType, $referenceId);
            return null;
        }

        $transaction = CashTransaction::where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->first();

        if ($transaction) {
            $transaction->amount = -abs($amount);
            if ($description) $transaction->description = $description;
            $transaction->save();
            return $transaction;
        }

        return $this->recordOutflow($shopId, $amount, $type, $description, $referenceType, $referenceId);
    }

    /**
     * Delete an existing transaction (e.g. when an expense is deleted)
     */
    public function deleteTransaction($referenceType, $referenceId)
    {
        return CashTransaction::where('reference_type', $referenceType)
            ->where('reference_id', $referenceId)
            ->delete();
    }
}
