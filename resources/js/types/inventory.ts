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

export interface ProductBatchReference {
    id: number;
    batch_name?: string;
    reason?: string;
    note?: string;
}

export interface ProductBatch {
    id: number;
    initial_quantity: number;
    remaining_quantity: number;
    retail_price: number | null;
    unit_cost: number;
    created_at: string;
    reference_type?: string | null;
    reference_id?: number | null;
    reference?: ProductBatchReference | null;
}

export interface VariantOption {
    name: string;
    values: string[];
}

export interface ProductVariant {
    id: number;
    product_id: number;
    sku: string;
    attributes: Record<string, string>;
    stock_quantity: number;
    pending_stock: number;
    retail_price: number | null;
    effective_retail_price: number;
    product?: Product;
    inventory_logs?: InventoryLog[];
    batches?: ProductBatch[];
    deleted_at?: string | null;
}

export interface Product {
    id: number;
    name: string;
    retail_price: number;
    base_cost: number;
    image: string | null;
    category_id?: number | null;
    category?: Category;
    type: "local" | "global";
    status: "in_stock" | "out_of_stock";
    is_active?: boolean;
    product_variant_id: number,
    variant_options: VariantOption[] | null;
    variants?: ProductVariant[];
}

export interface StockAdjustmentRequest {
    product_variant_id: string;
    action_type: 'add' | 'remove';
    quantity: string | number;
    reason: 'damage' | 'loss' | 'return' | 'correction';
    note?: string;
    batch_pricing_mode?: 'default' | 'existing' | 'new';
    selected_batch_id?: string | number;
    unit_cost?: string | number;
    retail_price?: string | number;
    update_variant_retail_price?: boolean;
}

export interface PurchaseOrderItemInput {
    product_variant_id: number;
    quantity: number | '';
    unit_cost: number | '';
    retail_price?: number | '';
}

export interface PurchaseOrderItem {
    id: number;
    purchase_order_id?: number;
    product_variant_id: number;
    product_variant?: ProductVariant;
    quantity: number;
    received_quantity?: number | null;
    original_cost: number;
    unit_cost: number;
    batch_unit_cost?: number | null;
    retail_price?: number | null;
    line_total: number;
    allocated_cargo_fee?: number | null;
    allocated_adjustment_amount?: number | null;
    batch_retail_price?: number | null;
    latest_retail_price?: number | null;
    previous_retail_prices?: number[];
    pending_retail_price?: number | null;
    product?: {
        id: number;
        name: string;
        sku: string | null;
        retail_price?: number;
    };
}

export interface PurchaseOrder {
    id: number;
    batch_name: string;
    order_type: string;
    status: "pending" | "partially_arrived" | "arrived" | "cancelled";
    supplier_name: string;
    supplier_id: number | null;
    supplier?: {
        id: number;
        name: string;
        currency?: string;
    };
    exchange_rate: number;
    total_goods_cost: number;
    total_discount?: number;
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
    activities?: any[];
    created_at: string;
    updated_at: string;
    foreign_deli_fee?: number;
    items?: PurchaseOrderItem[];
}
