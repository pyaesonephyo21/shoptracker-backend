import React, { useState, useMemo } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/SearchableSelect';
import { twMerge } from 'tailwind-merge';
import { SaleItemInput } from '@/types/sales';
import { Product } from '@/types/inventory';

export default function AddSale({ products = [] }: { products: Product[] }) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        customer_name: '',
        customer_phone: '',
        address: '',
        cart: [] as SaleItemInput[],
        discount_type: 'none' as 'none' | 'fixed' | 'percent',
        discount_value: '',
        discount_reason: '',
        overcharge: '',
        note: '',
        paid_amount: '',
        payment_method: 'kpay' as 'kpay' | 'cash' | 'ayapay'
    });

    const [selectedProduct, setSelectedProduct] = useState<string>('');

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
                quantity: '',
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

    const calculateFifoRetailPrice = (variant: any, requestedQty: number, parentProduct: any) => {
        const effectivePrice = variant.retail_price || (parentProduct ? parentProduct.retail_price : 0) || 0;

        if (!variant || !variant.batches || variant.batches.length === 0) {
            return {
                total: requestedQty * effectivePrice,
                average: effectivePrice,
                isMultiple: false
            };
        }

        let remaining = requestedQty;
        let total = 0;
        let pricesUsed = new Set<number>();

        for (const batch of variant.batches) {
            if (remaining <= 0) break;
            const take = Math.min(batch.remaining_quantity, remaining);
            const price = batch.retail_price !== null && batch.retail_price !== undefined ? batch.retail_price : effectivePrice;
            total += take * price;
            pricesUsed.add(price);
            remaining -= take;
        }

        if (remaining > 0) {
            const lastBatch = variant.batches[variant.batches.length - 1];
            const price = lastBatch && lastBatch.retail_price !== null && lastBatch.retail_price !== undefined ? lastBatch.retail_price : effectivePrice;
            total += remaining * price;
            pricesUsed.add(price);
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
            const basePrice = variant ? calculateFifoRetailPrice(variant, qty, parentProduct).average : (item.unit_price_snapshot || 0);

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

    const grandTotal = Math.max(0, subtotal - orderDiscountAmount + Number(data.overcharge || 0));
    const paidNum = Number(data.paid_amount) || 0;
    const remaining = grandTotal - paidNum;
    const isOverpaid = paidNum > grandTotal + 0.1;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (data.cart.length === 0) {
            alert('Please add at least one product to the order.');
            return;
        }

        post('/sales', {
            preserveScroll: true,
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
                        New Order.
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
                            <Button type="button" onClick={handleAddToCart} className="h-10 px-8 text-xl">
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
                                                    max={maxAllowed}
                                                />
                                                {errors[`cart.${index}.quantity` as keyof typeof errors] && <span className="text-red-500 text-xs">{errors[`cart.${index}.quantity` as keyof typeof errors]}</span>}
                                            </div>

                                            <div className="flex-1 flex flex-col justify-center">
                                                <span className="text-xs text-zinc-500 font-medium mb-1">Unit Price</span>
                                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                                    {variant && calculateFifoRetailPrice(variant, Number(item.quantity) || 0, parentProduct).isMultiple ? (
                                                        <span className="font-bold text-lg text-orange-500 dark:text-orange-400">
                                                            Varies (Diff Batches)
                                                        </span>
                                                    ) : (
                                                        <>
                                                            <span className={twMerge("font-bold text-lg", hasDiscount ? "text-zinc-400 line-through text-sm" : "text-black dark:text-white")}>
                                                                    {(variant ? calculateFifoRetailPrice(variant, Number(item.quantity) || 0, parentProduct).average : (item.unit_price_snapshot || 0)).toLocaleString()}
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

                    {/* 3. Payment & Totals */}
                    <section>
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 dark:text-zinc-400">
                            03. Payment
                        </h2>

                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-zinc-500 text-sm font-medium">Subtotal (After Item Disc.)</span>
                                <span className="text-black dark:text-white font-bold text-sm">{subtotal.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-4">
                                    <span className="text-zinc-500 text-sm font-medium">Extra Discount</span>
                                    <div className="flex bg-zinc-200 dark:bg-zinc-800 rounded-lg p-1">
                                        <button type="button" onClick={() => setData('discount_type', data.discount_type === 'fixed' ? 'none' : 'fixed')} className={twMerge("px-3 py-1 rounded text-[10px] font-bold", data.discount_type === 'fixed' ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "text-zinc-500")}>$</button>
                                        <button type="button" onClick={() => setData('discount_type', data.discount_type === 'percent' ? 'none' : 'percent')} className={twMerge("px-3 py-1 rounded text-[10px] font-bold", data.discount_type === 'percent' ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "text-zinc-500")}>%</button>
                                    </div>
                                </div>
                                <span className="text-green-600 dark:text-green-400 font-bold text-sm">-{orderDiscountAmount.toLocaleString()}</span>
                            </div>

                            {data.discount_type !== 'none' && (
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <FormattedNumberInput
                                        placeholder="Discount Value"
                                        value={data.discount_value}
                                        onChange={(val) => { setData('discount_value', val); clearErrors('discount_value'); }}
                                    />
                                    {errors.discount_value && <span className="text-red-500 text-xs">{errors.discount_value}</span>}
                                    <Input
                                        placeholder="Reason"
                                        value={data.discount_reason}
                                        onChange={(e) => { setData('discount_reason', e.target.value); clearErrors('discount_reason'); }}
                                    />
                                    {errors.discount_reason && <span className="text-red-500 text-xs">{errors.discount_reason}</span>}
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-4 mb-2">
                                <span className="text-zinc-500 text-sm font-medium">Overcharge</span>
                                <FormattedNumberInput
                                    placeholder="0"
                                    value={data.overcharge}
                                    onChange={(val) => { setData('overcharge', val); clearErrors('overcharge'); }}
                                    className="w-32 h-8 text-right font-bold"
                                />
                                {errors.overcharge && <span className="text-red-500 text-xs">{errors.overcharge}</span>}
                            </div>

                            <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-4" />

                            <div className="flex justify-between items-center">
                                <span className="text-black dark:text-white text-lg font-black uppercase">Grand Total</span>
                                <span className="text-black dark:text-white text-2xl font-black">
                                    {grandTotal.toLocaleString()} <span className="text-xs font-bold text-zinc-400">MMK</span>
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div className="bg-black dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
                                <span className="text-zinc-400 text-xs font-bold uppercase block mb-3">Deposit / Paid</span>
                                <FormattedNumberInput
                                    value={data.paid_amount}
                                    onChange={(val) => { setData('paid_amount', val); clearErrors('paid_amount'); }}
                                    placeholder="0"
                                    className="bg-transparent shadow-none border-none outline-none text-white font-black text-2xl w-full h-auto px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                                {errors.paid_amount && <span className="text-red-500 text-xs">{errors.paid_amount}</span>}
                                {Number(data.paid_amount) > 0 && (
                                    <div className="mt-5 pt-5 border-t border-zinc-800">
                                        <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest block mb-2">Deposit Method</span>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => setData('payment_method', 'cash')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${data.payment_method === 'cash' ? 'bg-white text-black shadow-md' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}>Cash</button>
                                            <button type="button" onClick={() => setData('payment_method', 'kpay')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${data.payment_method === 'kpay' ? 'bg-white text-black shadow-md' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}>KPay</button>
                                            <button type="button" onClick={() => setData('payment_method', 'ayapay')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${data.payment_method === 'ayapay' ? 'bg-white text-black shadow-md' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}>AYA</button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-end justify-center py-4">
                                {isOverpaid ? (
                                    <>
                                        <span className="text-[10px] text-zinc-400 uppercase font-bold">Overpaid</span>
                                        <span className="text-orange-500 font-bold text-lg">{Math.abs(remaining).toLocaleString()} MMK</span>
                                    </>
                                ) : remaining > 0 ? (
                                    <>
                                        <span className="text-[10px] text-zinc-400 uppercase font-bold">Remaining</span>
                                        <span className="text-orange-500 font-black text-2xl">{remaining.toLocaleString()} MMK</span>
                                    </>
                                ) : (
                                    <div className="bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-xl border border-green-200 dark:border-green-800">
                                        <span className="text-green-700 dark:text-green-400 text-sm font-black">✓ Fully Paid</span>
                                    </div>
                                )}
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
                        disabled={processing || isOverpaid || data.cart.length === 0}
                        className="w-full mt-4 h-12 text-sm font-bold tracking-wide"
                    >
                        {processing ? "CREATING..." : "CREATE ORDER"}
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
