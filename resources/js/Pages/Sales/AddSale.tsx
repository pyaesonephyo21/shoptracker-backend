import React, { useState, useMemo } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/SearchableSelect';
import { twMerge } from 'tailwind-merge';
import { SaleItemInput } from '@/types/sales';
import { Product } from '@/types/inventory';
import SmartAddressPaste from '@/components/SmartAddressPaste';

interface Courier {
    id: number;
    name: string;
    contact_info?: string;
    default_service_fee: number;
    default_overcharge: number;
}

export default function AddSale({ products = [], couriers = [] }: { products: Product[], couriers?: Courier[] }) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        customer_name: '',
        customer_phone: '',
        address: '',
        cart: [] as SaleItemInput[],
        discount_type: 'none' as 'none' | 'fixed' | 'percent',
        discount_value: '',
        discount_reason: '',
        extra_fee: '',
        note: '',
        paid_amount: '',
        payment_method: '',
        // Logistics (Optional)
        courier_id: '',
        tracking_number: '',
        delivery_fee: '',
        courier_service_fee: '',
        overcharge: '',
        delivery_note: '',
        money_collected_by: 'seller' as 'seller' | 'courier',
        is_deli_prepaid: false
    });

    const paymentMethods = usePage<any>().props.auth?.payment_methods || [];

    React.useEffect(() => {
        if (!data.payment_method && paymentMethods.length > 0) {
            setData('payment_method', paymentMethods[0].code);
        }
    }, [paymentMethods]);

    const [selectedProduct, setSelectedProduct] = useState<string>('');

    const selectedCourier = couriers.find(c => c.id === Number(data.courier_id));

    const productOptions = products.flatMap(p =>
        (p.variants || [])
            .map(v => {
                let displayStock = v.stock_quantity;
                let displayPending = v.pending_stock;

                if (displayStock < 0) {
                    displayPending = Math.max(0, displayPending + displayStock);
                    displayStock = 0;
                }

                return { v, displayStock, displayPending };
            })
            .filter(({ displayStock, displayPending }) => displayStock + displayPending > 0)
            .map(({ v, displayStock, displayPending }) => {
                const attributesLabel = Object.values(v.attributes || {}).join(' / ') || 'Default';
                return {
                    label: `${p.name} - ${attributesLabel} (S: ${displayStock}, P: ${displayPending})`,
                    value: String(v.id)
                };
            })
    );

    const handleAddToCart = () => {
        if (!selectedProduct) return;

        let variant = null;
        let parentProduct = null;
        for (const p of products) {
            variant = p.variants?.find(v => v.id === Number(selectedProduct));
            if (variant) {
                parentProduct = p;
                break;
            }
        }

        if (!variant || !parentProduct) return;

        setData('cart', [
            ...data.cart,
            {
                product_variant_id: variant.id,
                quantity: 1,
                unit_price_snapshot: variant.retail_price || parentProduct.retail_price || 0,
                discount_type: 'none',
                discount_value: '',
                discount_reason: ''
            }
        ]);
        setSelectedProduct('');
    };

    const handleUpdateItem = (index: number, field: keyof SaleItemInput, value: any) => {
        const newCart = [...data.cart];
        newCart[index] = { ...newCart[index], [field]: value };
        setData('cart', newCart);
    };

    const handleRemoveItem = (index: number) => {
        setData('cart', data.cart.filter((_, i) => i !== index));
    };

    const calculateUniformRetailPrice = (variant: any, requestedQty: number, parentProduct: any) => {
        const effectivePrice = variant.retail_price || (parentProduct ? parentProduct.retail_price : 0) || 0;

        let remaining = requestedQty;
        let total = 0;
        let pricesUsed = new Set<number>();

        // 1. Draw from In-Stock first (uniform price)
        const inStock = Math.max(0, variant.stock_quantity);
        if (remaining > 0 && inStock > 0) {
            const take = Math.min(inStock, remaining);
            total += take * effectivePrice;
            pricesUsed.add(effectivePrice);
            remaining -= take;
        }

        // 2. Draw from Pending POs if still remaining
        if (remaining > 0 && variant.purchase_order_items) {
            let skippedQty = variant.stock_quantity < 0 ? Math.abs(variant.stock_quantity) : 0;

            for (const poItem of variant.purchase_order_items) {
                if (remaining <= 0) break;
                
                let availableInThisPo = poItem.quantity;
                if (skippedQty > 0) {
                    const skip = Math.min(availableInThisPo, skippedQty);
                    availableInThisPo -= skip;
                    skippedQty -= skip;
                }

                if (availableInThisPo <= 0) continue;

                const take = Math.min(availableInThisPo, remaining);
                const price = poItem.retail_price !== null && poItem.retail_price !== undefined ? poItem.retail_price : effectivePrice;
                
                total += take * price;
                pricesUsed.add(price);
                remaining -= take;
            }
        }

        // 3. Fallback for any remaining oversell
        if (remaining > 0) {
            total += remaining * effectivePrice;
            pricesUsed.add(effectivePrice);
        }

        return {
            total,
            average: requestedQty > 0 ? (total / requestedQty) : 0,
            isMultiple: pricesUsed.size > 1
        };
    };

    // Derived State Calculations
    const subtotal = useMemo(() => {
        return data.cart.reduce((sum, item) => {
            let variant = null;
            let parentProduct = null;
            for (const p of products) {
                variant = p.variants?.find(v => v.id === item.product_variant_id);
                if (variant) {
                    parentProduct = p;
                    break;
                }
            }
            const qty = Number(item.quantity) || 0;
            const discountVal = Number(item.discount_value) || 0;
            const basePrice = variant ? calculateUniformRetailPrice(variant, qty, parentProduct).average : (item.unit_price_snapshot || 0);

            let effectivePrice = basePrice;
            if (item.discount_type === 'fixed') {
                effectivePrice = Math.max(0, effectivePrice - discountVal);
            } else if (item.discount_type === 'percent') {
                effectivePrice = Math.max(0, effectivePrice * (1 - discountVal / 100));
            }
            return sum + (effectivePrice * qty);
        }, 0);
    }, [data.cart]);

    const orderDiscountAmount = useMemo(() => {
        const val = Number(data.discount_value) || 0;
        if (data.discount_type === 'fixed') return val;
        if (data.discount_type === 'percent') return subtotal * (val / 100);
        return 0;
    }, [subtotal, data.discount_type, data.discount_value]);

    const deliveryFeeNum = Number(data.delivery_fee) || 0;
    const overchargeNum = Number(data.overcharge) || 0;

    const itemsTotal = Math.max(0, subtotal - orderDiscountAmount + Number(data.extra_fee || 0));
    const grandTotal = itemsTotal + (data.courier_id ? (deliveryFeeNum + overchargeNum) : 0);

    // Target amount collected directly by shop (deposit / upfront payment)
    const targetShopCollection = useMemo(() => {
        if (!data.courier_id) return grandTotal;
        if (data.money_collected_by === 'seller') {
            if (data.is_deli_prepaid) return grandTotal;
            return itemsTotal;
        }
        // COD order: shop collects whatever deposit is paid upfront (remaining will be collected by courier)
        return 0;
    }, [data.courier_id, data.money_collected_by, data.is_deli_prepaid, grandTotal, itemsTotal]);

    const paidNum = Number(data.paid_amount) || 0;
    const diff = targetShopCollection - paidNum;
    const remaining = data.money_collected_by === 'courier' && data.courier_id ? 0 : Math.max(0, diff);
    const overpaidAmount = targetShopCollection > 0 && paidNum > targetShopCollection ? (paidNum - targetShopCollection) : 0;
    const isOverpaid = overpaidAmount > 0.1;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (data.cart.length === 0) {
            alert('Please add at least one product to the order.');
            return;
        }

        post('/sales', {
            preserveScroll: (page) => Object.keys(page.props.errors || {}).length > 0,
            onError: (err) => {
                if (Object.keys(err).length === 0) {
                    alert('Failed to create order');
                }
            }
        });
    };

    return (
        <AppLayout title="Add Sale">
            <Head title="New Order" />

            <div className="flex flex-col max-w-4xl mx-auto w-full">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                        New Order
                    </h1>
                    <button
                        type="button"
                        onClick={() => router.visit('/sales')}
                        className="text-zinc-500 font-bold hover:text-black dark:hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-10 pb-20">

                    {/* 1. Customer */}
                    <section>
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 dark:text-zinc-400">
                            01. Customer
                        </h2>

                        {/* Smart Address Paste */}
                        <SmartAddressPaste
                            onApply={({ customer_name, customer_phone, address, delivery_notes }) => {
                                if (customer_name) setData('customer_name', customer_name);
                                if (customer_phone) setData('customer_phone', customer_phone);
                                if (address) setData('address', address);
                                if (delivery_notes) setData('note', delivery_notes);
                            }}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="customer_name">Name (Optional)</Label>
                                <Input
                                    id="customer_name"
                                    value={data.customer_name}
                                    onChange={(e) => { setData('customer_name', e.target.value); clearErrors('customer_name'); }}
                                />
                                {errors.customer_name && <span className="text-red-500 text-xs">{errors.customer_name}</span>}
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="customer_phone">Phone (Optional)</Label>
                                <Input
                                    id="customer_phone"
                                    type="tel"
                                    value={data.customer_phone}
                                    onChange={(e) => { setData('customer_phone', e.target.value); clearErrors('customer_phone'); }}
                                />
                                {errors.customer_phone && <span className="text-red-500 text-xs">{errors.customer_phone}</span>}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="address">Address (Optional)</Label>
                            <textarea
                                id="address"
                                value={data.address}
                                onChange={(e) => { setData('address', e.target.value); clearErrors('address'); }}
                                className="flex min-h-[80px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300 resize-y"
                            />
                            {errors.address && <span className="text-red-500 text-xs">{errors.address}</span>}
                        </div>
                    </section>

                    {/* 2. Products */}
                    <section>
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 dark:text-zinc-400">
                            02. Products ({data.cart.length})
                        </h2>

                        <div className="flex items-end gap-4 mb-6">
                            <div className="flex-1 flex flex-col gap-2">
                                <Label>Add Product</Label>
                                <SearchableSelect
                                    value={selectedProduct}
                                    onValueChange={(val) => setSelectedProduct(val)}
                                    options={productOptions}
                                    placeholder="Select a product..."
                                />
                            </div>
                            <Button type="button" onClick={handleAddToCart} className="h-10 px-8 text-xl font-bold">
                                +
                            </Button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {data.cart.map((item, index) => {
                                let variant = null;
                                let parentProduct = null;
                                let productName = `Item #${index + 1}`;
                                for (const p of products) {
                                    variant = p.variants?.find(v => v.id === item.product_variant_id);
                                    if (variant) {
                                        parentProduct = p;
                                        productName = `${p.name} - ${Object.values(variant.attributes || {}).join(' / ') || 'Default'}`;
                                        break;
                                    }
                                }

                                // Calculate dynamically available stock for THIS row
                                let stock = 0;
                                let pending = 0;
                                let maxAllowed = 1;

                                if (variant) {
                                    const previousQty = data.cart.slice(0, index).filter(i => i.product_variant_id === variant.id).reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
                                    let remainingStock = variant.stock_quantity - previousQty;
                                    let remainingPending = variant.pending_stock;

                                    if (remainingStock < 0) {
                                        remainingPending += remainingStock;
                                        remainingStock = 0;
                                    }

                                    remainingPending = Math.max(0, remainingPending);

                                    stock = remainingStock;
                                    pending = remainingPending;
                                    maxAllowed = stock + pending;
                                }

                                const hasDiscount = item.discount_type !== 'none';

                                let effectivePrice = Number(item.unit_price_snapshot) || 0;
                                if (item.discount_type === 'fixed') effectivePrice = Math.max(0, effectivePrice - (Number(item.discount_value) || 0));
                                if (item.discount_type === 'percent') effectivePrice = Math.max(0, effectivePrice * (1 - (Number(item.discount_value) || 0) / 100));

                                return (
                                    <div key={index} className="p-5 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                        <div className="flex justify-between items-start gap-4 mb-4">
                                            <h3 className="font-bold text-black dark:text-white uppercase tracking-wide flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                                <span>{productName}</span>
                                                <span className="text-[10px] sm:text-xs text-zinc-400 normal-case tracking-normal font-medium">
                                                    (In Stock: {stock}, Pending: {pending})
                                                </span>
                                            </h3>
                                            <button type="button" onClick={() => handleRemoveItem(index)} className="shrink-0 text-[10px] font-bold text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                                                REMOVE
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap md:flex-nowrap gap-4 mb-4">
                                            <div className="w-24 flex flex-col gap-2">
                                                <Label>Qty</Label>
                                                <Input
                                                    type="number"
                                                    value={item.quantity === '' ? '' : String(item.quantity)}
                                                    onChange={(e) => {
                                                        const val = e.target.value === '' ? '' : Number(e.target.value);
                                                        if (val !== '' && val > maxAllowed) {
                                                            handleUpdateItem(index, 'quantity', maxAllowed);
                                                        } else {
                                                            handleUpdateItem(index, 'quantity', val);
                                                        }
                                                        clearErrors(`cart.${index}.quantity` as any);
                                                    }}
                                                    min="1"
                                                    max={maxAllowed > 0 ? maxAllowed : 1}
                                                />
                                                {errors[`cart.${index}.quantity` as keyof typeof errors] && <span className="text-red-500 text-xs">{errors[`cart.${index}.quantity` as keyof typeof errors]}</span>}
                                            </div>

                                            <div className="flex-1 flex flex-col justify-center">
                                                <span className="text-xs text-zinc-500 font-medium mb-1">Unit Price</span>
                                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                                    {variant && calculateUniformRetailPrice(variant, Number(item.quantity) || 0, parentProduct).isMultiple ? (
                                                        <span className="font-bold text-lg text-orange-500 dark:text-orange-400">
                                                            Varies (In-Stock/Pending)
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <span className={twMerge("font-bold text-lg", hasDiscount ? "text-zinc-400 line-through text-sm" : "text-black dark:text-white")}>
                                                                {(variant ? calculateUniformRetailPrice(variant, Number(item.quantity) || 0, parentProduct).average : (item.unit_price_snapshot || 0)).toLocaleString()}
                                                            </span>
                                                            {hasDiscount && (
                                                                <span className="text-black dark:text-white font-bold text-lg">
                                                                    → {effectivePrice.toLocaleString()} <span className="text-xs">MMK</span>
                                                                </span>
                                                            )}
                                                            {!hasDiscount && <span className="text-xs font-bold text-black dark:text-white">MMK</span>}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase">Item Discount</span>
                                                <div className="flex bg-zinc-200 dark:bg-zinc-800 rounded-lg p-1">
                                                    <button type="button" onClick={() => handleUpdateItem(index, 'discount_type', item.discount_type === 'fixed' ? 'none' : 'fixed')} className={twMerge("px-4 py-1 rounded text-[10px] font-bold", item.discount_type === 'fixed' ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "text-zinc-500")}>$</button>
                                                    <button type="button" onClick={() => handleUpdateItem(index, 'discount_type', item.discount_type === 'percent' ? 'none' : 'percent')} className={twMerge("px-4 py-1 rounded text-[10px] font-bold", item.discount_type === 'percent' ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "text-zinc-500")}>%</button>
                                                </div>
                                            </div>

                                            {hasDiscount && (
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="col-span-1">
                                                        <FormattedNumberInput
                                                            placeholder="Value"
                                                            value={item.discount_value === '' ? '' : String(item.discount_value)}
                                                            onChange={(val) => { handleUpdateItem(index, 'discount_value', val === '' ? '' : Number(val)); clearErrors(`cart.${index}.discount_value` as any); }}
                                                        />
                                                        {errors[`cart.${index}.discount_value` as keyof typeof errors] && <span className="text-red-500 text-xs">{errors[`cart.${index}.discount_value` as keyof typeof errors]}</span>}
                                                    </div>
                                                    <div className="col-span-2">
                                                        <Input
                                                            placeholder="Reason (Optional)"
                                                            value={item.discount_reason}
                                                            onChange={(e) => handleUpdateItem(index, 'discount_reason', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {data.cart.length === 0 && (
                                <div className="p-8 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                                    <p className="text-zinc-400 font-medium">Cart is empty</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 3. Delivery & Courier (Optional) */}
                    <section>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest dark:text-zinc-400">
                                03. Delivery & Courier (Optional)
                            </h2>
                            {data.courier_id && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setData(d => ({
                                            ...d,
                                            courier_id: '',
                                            tracking_number: '',
                                            delivery_fee: '',
                                            courier_service_fee: '',
                                            overcharge: '',
                                            delivery_note: '',
                                            money_collected_by: 'seller',
                                            is_deli_prepaid: false
                                        }));
                                    }}
                                    className="text-xs font-bold text-zinc-400 hover:text-red-500 transition-colors"
                                >
                                    Clear Delivery
                                </button>
                            )}
                        </div>

                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <Label>Select Method / Courier</Label>
                                <Select
                                    value={data.courier_id}
                                    onValueChange={(val) => {
                                        if (!val) return;
                                        const selected = couriers.find(c => c.id === Number(val));
                                        setData(d => ({
                                            ...d,
                                            courier_id: val,
                                            courier_service_fee: selected ? String(Number(selected.default_service_fee || 0)) : d.courier_service_fee,
                                            overcharge: selected ? String(Number(selected.default_overcharge || 0)) : d.overcharge
                                        }));
                                    }}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a courier (or leave empty to arrange later)...">
                                            {selectedCourier ? selectedCourier.name : "Choose a courier (or leave empty to arrange later)..."}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {couriers.map(c => (
                                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {data.courier_id && (
                                <div className="flex flex-col gap-6 p-5 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <Label>Deli Fee (Customer)</Label>
                                            <FormattedNumberInput
                                                value={data.delivery_fee}
                                                onChange={(val) => { setData('delivery_fee', val); clearErrors('delivery_fee'); }}
                                                placeholder="e.g. 3500"
                                            />
                                            {errors.delivery_fee && <span className="text-red-500 text-xs">{errors.delivery_fee}</span>}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Label>Overcharge (Income)</Label>
                                            <FormattedNumberInput
                                                value={data.overcharge}
                                                onChange={(val) => { setData('overcharge', val); clearErrors('overcharge'); }}
                                                placeholder="0"
                                            />
                                            {errors.overcharge && <span className="text-red-500 text-xs">{errors.overcharge}</span>}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Label>Service Fee (Cost)</Label>
                                            <FormattedNumberInput
                                                value={data.courier_service_fee}
                                                onChange={(val) => { setData('courier_service_fee', val); clearErrors('courier_service_fee'); }}
                                                placeholder="0"
                                            />
                                            {errors.courier_service_fee && <span className="text-red-500 text-xs">{errors.courier_service_fee}</span>}
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <Label>Tracking No. (Optional)</Label>
                                        <Input
                                            value={data.tracking_number}
                                            onChange={(e) => { setData('tracking_number', e.target.value); clearErrors('tracking_number'); }}
                                            placeholder="e.g. TRK12345"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-3">
                                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                            Payment & Delivery Scenario
                                        </Label>

                                        <div className="flex flex-col gap-3">
                                            <button
                                                type="button"
                                                onClick={() => { setData('money_collected_by', 'seller'); setData('is_deli_prepaid', true); }}
                                                className={twMerge("p-4 rounded-xl border-2 text-left transition-all",
                                                    data.money_collected_by === 'seller' && data.is_deli_prepaid ? "border-black bg-white dark:border-white dark:bg-zinc-800" : "border-zinc-200 bg-transparent text-zinc-500 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700")}
                                            >
                                                <span className={twMerge("block font-bold text-sm mb-1", data.money_collected_by === 'seller' && data.is_deli_prepaid ? "text-black dark:text-white" : "")}>
                                                    Fully Prepaid (Deli Included)
                                                </span>
                                                <span className="text-xs text-zinc-500">Customer paid us for everything (items + deli fee). Shop pays courier.</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => { setData('money_collected_by', 'seller'); setData('is_deli_prepaid', false); }}
                                                className={twMerge("p-4 rounded-xl border-2 text-left transition-all",
                                                    data.money_collected_by === 'seller' && !data.is_deli_prepaid ? "border-black bg-white dark:border-white dark:bg-zinc-800" : "border-zinc-200 bg-transparent text-zinc-500 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700")}
                                            >
                                                <span className={twMerge("block font-bold text-sm mb-1", data.money_collected_by === 'seller' && !data.is_deli_prepaid ? "text-black dark:text-white" : "")}>
                                                    Items Prepaid (Deli Separate)
                                                </span>
                                                <span className="text-xs text-zinc-500">Customer paid us for items. Customer pays delivery fee to courier.</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const selected = couriers.find(c => c.id === Number(data.courier_id));
                                                    setData(d => ({
                                                        ...d,
                                                        money_collected_by: 'courier',
                                                        is_deli_prepaid: false,
                                                        overcharge: selected ? String(Number(selected.default_overcharge || 0)) : d.overcharge
                                                    }));
                                                }}
                                                className={twMerge("p-4 rounded-xl border-2 text-left transition-all",
                                                    data.money_collected_by === 'courier' ? "border-black bg-white dark:border-white dark:bg-zinc-800" : "border-zinc-200 bg-transparent text-zinc-500 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700")}
                                            >
                                                <span className={twMerge("block font-bold text-sm mb-1", data.money_collected_by === 'courier' ? "text-black dark:text-white" : "")}>
                                                    COD (Courier Collects All)
                                                </span>
                                                <span className="text-xs text-zinc-500">Customer pays items & delivery fee to the courier in cash.</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <Label>Delivery Instructions (Optional)</Label>
                                        <Input
                                            value={data.delivery_note}
                                            onChange={(e) => { setData('delivery_note', e.target.value); clearErrors('delivery_note'); }}
                                            placeholder="e.g. Call before arrival..."
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* 4. Payment */}
                    <section>
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 dark:text-zinc-400">
                            04. Payment
                        </h2>

                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                            <div className="p-6 md:p-8">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-zinc-500 text-sm font-medium">Subtotal (After Item Disc.)</span>
                                    <span className="text-black dark:text-white font-bold text-sm">{subtotal.toLocaleString()} MMK</span>
                                </div>

                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-4">
                                        <span className="text-zinc-500 text-sm font-medium">Extra Discount</span>
                                        <div className="flex bg-zinc-200 dark:bg-zinc-800 rounded-lg p-1">
                                            <button type="button" onClick={() => setData('discount_type', data.discount_type === 'fixed' ? 'none' : 'fixed')} className={twMerge("px-3 py-1 rounded text-[10px] font-bold transition-all", data.discount_type === 'fixed' ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "text-zinc-500 hover:text-black dark:hover:text-white")}>$</button>
                                            <button type="button" onClick={() => setData('discount_type', data.discount_type === 'percent' ? 'none' : 'percent')} className={twMerge("px-3 py-1 rounded text-[10px] font-bold transition-all", data.discount_type === 'percent' ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "text-zinc-500 hover:text-black dark:hover:text-white")}>%</button>
                                        </div>
                                    </div>
                                    <span className="text-green-600 dark:text-green-400 font-bold text-sm">-{orderDiscountAmount.toLocaleString()} MMK</span>
                                </div>

                                {data.discount_type !== 'none' && (
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <FormattedNumberInput
                                            placeholder="Discount Value"
                                            value={data.discount_value}
                                            onChange={(val) => { setData('discount_value', val); clearErrors('discount_value'); }}
                                        />
                                        <Input
                                            placeholder="Reason"
                                            value={data.discount_reason}
                                            onChange={(e) => { setData('discount_reason', e.target.value); clearErrors('discount_reason'); }}
                                        />
                                    </div>
                                )}

                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-zinc-500 text-sm font-medium">Extra Fee (e.g. KPay %)</span>
                                    <div className="flex flex-col items-end">
                                        <FormattedNumberInput
                                            placeholder="0"
                                            value={data.extra_fee}
                                            onChange={(val) => { setData('extra_fee', val); clearErrors('extra_fee'); }}
                                            className="w-32 h-8 text-right font-bold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                                        />
                                        {errors.extra_fee && <span className="text-red-500 text-xs mt-1">{errors.extra_fee}</span>}
                                    </div>
                                </div>

                                {data.courier_id && (deliveryFeeNum > 0 || overchargeNum > 0) && (
                                    <>
                                        {deliveryFeeNum > 0 && (
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-zinc-500 text-sm font-medium">Delivery Fee</span>
                                                <span className="text-black dark:text-white font-bold text-sm">+{deliveryFeeNum.toLocaleString()} MMK</span>
                                            </div>
                                        )}
                                        {overchargeNum > 0 && (
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-zinc-500 text-sm font-medium">Courier Overcharge</span>
                                                <span className="text-black dark:text-white font-bold text-sm">+{overchargeNum.toLocaleString()} MMK</span>
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-6" />

                                <div className="flex justify-between items-center">
                                    <span className="text-black dark:text-white text-lg font-black uppercase tracking-tight">Grand Total</span>
                                    <span className="text-black dark:text-white text-3xl font-black tracking-tight">
                                        {grandTotal.toLocaleString()} <span className="text-sm font-bold text-zinc-400">MMK</span>
                                    </span>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-zinc-950/50 p-6 md:p-8 border-t border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row gap-8 justify-between items-center">
                                <div className="w-full md:w-1/2 bg-black dark:bg-zinc-900 p-5 rounded-2xl shadow-inner border border-zinc-800">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-zinc-400 text-xs font-bold uppercase tracking-widest">Deposit / Paid</span>
                                        {targetShopCollection > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setData('paid_amount', String(targetShopCollection))}
                                                className="text-[10px] font-bold text-zinc-400 hover:text-white uppercase tracking-widest transition-colors"
                                            >
                                                Full Amount
                                            </button>
                                        )}
                                    </div>
                                    <FormattedNumberInput
                                        value={data.paid_amount}
                                        onChange={(val) => { setData('paid_amount', val); clearErrors('paid_amount'); }}
                                        placeholder="0"
                                        className="bg-transparent shadow-none border-none outline-none text-white font-black text-3xl w-full h-auto px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                    />
                                    {errors.paid_amount && <span className="text-red-500 text-xs">{errors.paid_amount}</span>}
                                    
                                    {Number(data.paid_amount) > 0 && (
                                        <div className="mt-5 pt-5 border-t border-zinc-800/50">
                                            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block mb-3">Deposit Method</span>
                                            <div className="flex flex-wrap gap-2">
                                                {paymentMethods.length > 0 ? paymentMethods.map((method: any) => (
                                                    <button
                                                        key={method.code}
                                                        type="button"
                                                        onClick={() => setData('payment_method', method.code)}
                                                        className={twMerge("flex-1 min-w-[60px] py-2 px-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all text-center whitespace-nowrap", data.payment_method === method.code ? 'bg-white text-black shadow-md scale-105' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 active:scale-95')}
                                                    >
                                                        {method.name}
                                                    </button>
                                                )) : (
                                                    <span className="text-xs text-zinc-500 italic py-2">No payment methods configured.</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="w-full md:w-1/2 flex flex-col items-center md:items-end justify-center py-4">
                                    {isOverpaid ? (
                                        <>
                                            <span className="text-xs text-zinc-400 uppercase font-bold tracking-widest mb-1">Extra Payment</span>
                                            <span className="text-orange-500 font-black text-3xl">+{overpaidAmount.toLocaleString()} <span className="text-sm">MMK</span></span>
                                        </>
                                    ) : remaining > 0 ? (
                                        <>
                                            <span className="text-xs text-zinc-400 uppercase font-bold tracking-widest mb-1">Remaining Due</span>
                                            <span className="text-orange-500 font-black text-4xl tracking-tight">{remaining.toLocaleString()} <span className="text-lg">MMK</span></span>
                                        </>
                                    ) : (
                                        <div className="bg-green-100 dark:bg-green-900/30 px-6 py-4 rounded-2xl border-2 border-green-200 dark:border-green-800 shadow-sm flex items-center gap-3">
                                            <div className="bg-green-500 rounded-full p-1 text-white">
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                            <span className="text-green-700 dark:text-green-400 text-lg font-black tracking-tight">Fully Paid</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="flex flex-col gap-2">
                        <Label htmlFor="note">General Note (Optional)</Label>
                        <Input
                            id="note"
                            placeholder="Optional..."
                            value={data.note}
                            onChange={(e) => { setData('note', e.target.value); clearErrors('note'); }}
                        />
                        {errors.note && <span className="text-red-500 text-xs">{errors.note}</span>}
                    </section>

                    <Button
                        type="submit"
                        disabled={processing || data.cart.length === 0}
                        className="w-full mt-4 h-12 text-sm font-bold tracking-wide"
                    >
                        {processing ? "CREATING..." : "CREATE ORDER"}
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
