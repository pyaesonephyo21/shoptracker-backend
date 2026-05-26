import React, { useState, useMemo } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { twMerge } from 'tailwind-merge';
import { SaleItemInput } from '@/types/sales';
import { Product } from '@/types/inventory';

export default function AddSale({ products = [] }: { products: Product[] }) {
    const { data, setData, post, processing, errors } = useForm({
        customer_name: '',
        customer_phone: '',
        address: '',
        cart: [] as SaleItemInput[],
        discount_type: 'none' as 'none' | 'fixed' | 'percent',
        discount_value: '',
        discount_reason: '',
        note: '',
        paid_amount: ''
    });

    const [selectedProduct, setSelectedProduct] = useState<string>('');

    const productOptions = products.map(p => ({
        label: `${p.name} (S: ${p.stock_quantity}, P: ${p.pending_stock})`,
        value: String(p.id)
    }));

    const handleAddToCart = () => {
        if (!selectedProduct) return;
        const product = products.find(p => p.id === Number(selectedProduct));
        if (!product) return;

        setData('cart', [
            ...data.cart,
            {
                product_id: product.id,
                quantity: 1,
                unit_price_snapshot: product.retail_price || 0,
                discount_type: 'none',
                discount_value: 0,
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

    // Derived State Calculations
    const subtotal = useMemo(() => {
        return data.cart.reduce((sum, item) => {
            let effectivePrice = item.unit_price_snapshot;
            if (item.discount_type === 'fixed') {
                effectivePrice = Math.max(0, effectivePrice - item.discount_value);
            } else if (item.discount_type === 'percent') {
                effectivePrice = Math.max(0, effectivePrice * (1 - item.discount_value / 100));
            }
            return sum + (effectivePrice * item.quantity);
        }, 0);
    }, [data.cart]);

    const orderDiscountAmount = useMemo(() => {
        const val = Number(data.discount_value) || 0;
        if (data.discount_type === 'fixed') return val;
        if (data.discount_type === 'percent') return subtotal * (val / 100);
        return 0;
    }, [subtotal, data.discount_type, data.discount_value]);

    const grandTotal = Math.max(0, subtotal - orderDiscountAmount);
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
                                <Label htmlFor="customer_name">Name</Label>
                                <Input
                                    id="customer_name"
                                    value={data.customer_name}
                                    onChange={(e) => setData('customer_name', e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="customer_phone">Phone</Label>
                                <Input
                                    id="customer_phone"
                                    type="tel"
                                    value={data.customer_phone}
                                    onChange={(e) => setData('customer_phone', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                value={data.address}
                                onChange={(e) => setData('address', e.target.value)}
                            />
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
                                <Select value={selectedProduct} onValueChange={(val) => setSelectedProduct(val ?? '')}>
                                    <SelectTrigger className="w-full h-10">
                                        <SelectValue placeholder="Select a product...">
                                            {selectedProduct ? productOptions.find(p => p.value === selectedProduct)?.label : "Select a product..."}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {productOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="button" onClick={handleAddToCart} className="h-10 px-8 text-xl">
                                +
                            </Button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {data.cart.map((item, index) => {
                                const product = products.find(p => p.id === item.product_id);
                                const productName = product?.name || `Item #${index + 1}`;

                                // Calculate dynamically available stock for THIS row
                                let stock = 0;
                                let pending = 0;
                                let maxAllowed = 1;

                                if (product) {
                                    const previousQty = data.cart.slice(0, index).filter(i => i.product_id === product.id).reduce((sum, i) => sum + i.quantity, 0);
                                    let remainingStock = product.stock_quantity - previousQty;
                                    let remainingPending = product.pending_stock;

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

                                let effectivePrice = item.unit_price_snapshot;
                                if (item.discount_type === 'fixed') effectivePrice = Math.max(0, effectivePrice - item.discount_value);
                                if (item.discount_type === 'percent') effectivePrice = Math.max(0, effectivePrice * (1 - item.discount_value / 100));

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
                                                    value={String(item.quantity)}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        if (val > maxAllowed) {
                                                            handleUpdateItem(index, 'quantity', maxAllowed);
                                                        } else {
                                                            handleUpdateItem(index, 'quantity', val);
                                                        }
                                                    }}
                                                    min="1"
                                                    max={maxAllowed}
                                                />
                                            </div>

                                            <div className="flex-1 flex flex-col justify-center">
                                                <span className="text-xs text-zinc-500 font-medium mb-1">Unit Price</span>
                                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                                                    <span className={twMerge("font-bold text-lg", hasDiscount ? "text-zinc-400 line-through text-sm" : "text-black dark:text-white")}>
                                                        {item.unit_price_snapshot.toLocaleString()}
                                                    </span>
                                                    {hasDiscount && (
                                                        <span className="text-black dark:text-white font-bold text-lg">
                                                            → {effectivePrice.toLocaleString()} <span className="text-xs">MMK</span>
                                                        </span>
                                                    )}
                                                    {!hasDiscount && <span className="text-xs font-bold text-black dark:text-white">MMK</span>}
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
                                                        <Input
                                                            type="number"
                                                            placeholder="Value"
                                                            value={item.discount_value === 0 ? '' : String(item.discount_value)}
                                                            onChange={(e) => handleUpdateItem(index, 'discount_value', Number(e.target.value))}
                                                        />
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
                                    <Input
                                        type="number"
                                        placeholder="Discount Value"
                                        value={data.discount_value}
                                        onChange={(e) => setData('discount_value', e.target.value)}
                                    />
                                    <Input
                                        placeholder="Reason"
                                        value={data.discount_reason}
                                        onChange={(e) => setData('discount_reason', e.target.value)}
                                    />
                                </div>
                            )}

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
                                <input
                                    type="number"
                                    value={data.paid_amount}
                                    onChange={(e) => setData('paid_amount', e.target.value)}
                                    placeholder="0"
                                    className="bg-transparent border-none outline-none text-white font-black text-2xl w-full"
                                />
                            </div>

                            <div className="flex flex-col items-end justify-center py-4">
                                {isOverpaid ? (
                                    <>
                                        <span className="text-[10px] text-red-500 uppercase font-black">Error</span>
                                        <span className="text-red-500 font-bold text-lg">Overpaid</span>
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
                        <Label htmlFor="note">General Note</Label>
                        <Input
                            id="note"
                            placeholder="Optional..."
                            value={data.note}
                            onChange={(e) => setData('note', e.target.value)}
                        />
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
