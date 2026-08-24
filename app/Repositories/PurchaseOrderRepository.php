<?php

namespace App\Repositories;

use App\Models\PurchaseOrder;
use Illuminate\Support\Facades\DB;

class PurchaseOrderRepository
{
    public function getAll(array $filters, int $perPage = 20)
    {
        // We eagerly load 'items' and 'items.productVariant.product' to see what's inside the batch
        return PurchaseOrder::with(['items.productVariant.product'])
            ->latest()
            ->paginate($perPage);
    }

    public function findById($id): PurchaseOrder
    {
        return PurchaseOrder::with(['items.productVariant.product'])->findOrFail($id);
    }

    /**
     * Create PO and Items in one Database Transaction.
     * If saving items fails, the PO is cancelled automatically.
     */
    public function create(array $data, array $items): PurchaseOrder
    {
        return DB::transaction(function () use ($data, $items) {
            // 1. Create the Main PO
            $po = PurchaseOrder::create($data);

            // 2. Create the Items
            // We expect $items to be an array like: [['product_id'=>1, 'quantity'=>10, 'unit_cost'=>5000], ...]
            $po->items()->createMany($items);

            return $po;
        });
    }

    public function updateStatus($id, $status)
    {
        $po = $this->findById($id);
        $po->update(['status' => $status]);

        return $po;
    }
}
