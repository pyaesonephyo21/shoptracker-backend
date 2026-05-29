export interface SalesOrder {
    cancel_reason: boolean;
    id: number;
    date: string;
    customer: {
        name: string | null;
        phone: string | null;
        address: string | null;
    };
    status: string;
    is_preorder?: boolean;

    financials: {
        subtotal: number;
        discount: number;
        discount_type: "fixed" | "percent" | "none";
        discount_value: number;
        discount_reason: string | null;
        paid_amount: number;
        balance: number;
        payment_status: "paid" | "partial" | "unpaid" | "overpaid";
        grand_total: number;
        net_revenue: number;
        total_cost: number;
        return_cost: number;
        profit: number;
        overcharge: number;
    };

    delivery: {
        courier_name: string;
        tracking: string | null;
        fee: number;
        courier_service_fee: number;
        is_prepaid: boolean;
        collected_by: string;
        settlement_status: string;
    };

    items: {
        id: number;
        product_name: string;
        quantity: number;
        price: number;
        total: number;
        discount_value: number;
        discount_type: "fixed" | "percent" | "none";
        discount_reason: string | null;
    }[];

    note: string | null;

    audit_log?: {
        action: string;
        by: string;
        at: string;
        details?: Record<string, unknown>;
    }[];
}

export interface SaleItemInput {
    product_id: number;
    quantity: number | '';
    discount_type: "none" | "fixed" | "percent";
    discount_value: number | '';
    discount_reason?: string;
    unit_price_snapshot: number;
}

export interface CreateSaleRequest {
    customer_name?: string;
    customer_phone?: string;
    delivery_address?: string;

    courier_id?: number | null;
    tracking_number?: string;
    delivery_fee: number;
    courier_service_fee: number;
    is_deli_prepaid: boolean;
    money_collected_by: "seller" | "courier";

    payment_method: "kpay" | "cash" | "cod";
    paid_amount: number;

    discount_type: "none" | "fixed" | "percent";
    discount_value: number;
    discount_reason?: string;
    overcharge?: number | '';

    note?: string;
    items: SaleItemInput[];
}
