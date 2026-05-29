export interface Category {
    id: number;
    name: string;
    products_count?: number;
}

export interface InventoryLog {
    id: number;
    quantity_change: number;
    new_stock_level: number;
    reason: string;
    note: string | null;
    created_at: string;
}

export interface ProductBatch {
    id: number;
    initial_quantity: number;
    remaining_quantity: number;
    retail_price: number;
    unit_cost: number;
    created_at: string;
}

export interface Product {
    id: number;
    name: string;
    sku: string;
    retail_price: number;
    base_cost: number;
    image: string | null;
    stock_quantity: number;
    pending_stock: number;
    category_id?: number | null;
    category?: Category;
    type: "local" | "global";
    status: "in_stock" | "out_of_stock";
    inventory_logs?: InventoryLog[];
    batches?: ProductBatch[];
}

export interface StockAdjustmentRequest {
    product_id: number;
    quantity: number;
    reason: "damage" | "loss" | "return" | "correction";
    note?: string;
}

export interface PurchaseOrderItemInput {
    product_id: number;
    quantity: number | '';
    unit_cost: number | '';
    retail_price?: number | '';
}

export interface PurchaseOrderItem {
    id: number;
    product_id: number;
    quantity: number;
    received_quantity?: number | null;
    original_cost: number;
    unit_cost: number;
    retail_price?: number;
    line_total: number;
    batch_retail_price?: number | null;
    latest_retail_price?: number | null;
    previous_retail_prices?: number[];
    pending_retail_price?: number | null;
    product: {
        id: number;
        name: string;
        sku: string | null;
        retail_price?: number;
    };
}

export interface PurchaseOrder {
    id: number;
    batch_name: string;
    status: "pending" | "arrived" | "cancelled";
    supplier_name: string;
    supplier_id: number | null;
    exchange_rate: number;
    total_goods_cost: number;
    supplier_fee: number;
    cargo_fee: number;
    local_deli_fee: number;
    grand_total: number;
    adjustment_amount?: number;
    adjustment_reason?: string | null;
    payment_status: "paid" | "partial" | "unpaid";
    paid_amount: number;
    note: string | null;
    cancel_reason?: string | null;
    audit_log?: any[];
    created_at: string;
    updated_at: string;
    items?: PurchaseOrderItem[];
}
