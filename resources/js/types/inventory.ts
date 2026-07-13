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
    product_id: number;
    quantity: number;
    reason: "damage" | "loss" | "return" | "correction";
    note?: string;
}

export interface PurchaseOrderItemInput {
    product_variant_id: number;
    quantity: number | '';
    unit_cost: number | '';
    retail_price?: number | '';
}

export interface PurchaseOrderItem {
    batch_unit_cost: undefined;
    product_variant: any;
    id: number;
    product_variant_id: number;
    quantity: number;
    received_quantity?: number | null;
    original_cost: number;
    unit_cost: number;
    retail_price?: number;
    line_total: number;
    allocated_cargo_fee?: number | null;
    allocated_adjustment_amount?: number | null;
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
    total_discount(total_discount: any): unknown;
    supplier: any;
    order_type: string;
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
    foreign_deli_fee?: number;

    items?: PurchaseOrderItem[];
}
