import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product, PurchaseOrderItemInput } from '@/types/inventory';
import { twMerge } from 'tailwind-merge';

interface Supplier {
    id: number;
    name: string;
    currency: string;
}

export default function AddPurchaseOrder({ products = [], suppliers = [], currencyLabel = "CNY", isForeignOrder = true }: { products: Product[], suppliers: Supplier[], currencyLabel: string, isForeignOrder: boolean }) {
    const [orderType, setOrderType] = useState<'local' | 'global'>('local');

    const { data, setData, post, transform, processing, errors } = useForm({
        batch_name: '',
        supplier_id: '',
        shop_name: '',
        exchange_rate: '',
        items: [] as PurchaseOrderItemInput[],
        supplier_fee: '',
        paid_amount: '',
        note: ''
    });

    const selectedSupplier = suppliers.find(s => String(s.id) === data.supplier_id);
    const dynamicCurrency = orderType === 'local' ? 'MMK' : (selectedSupplier?.currency || currencyLabel);
    const showExchangeRate = orderType === 'global' && dynamicCurrency !== 'MMK';

    const [selectedProduct, setSelectedProduct] = useState<string>('');

    const handleAddItem = () => {
        if (!selectedProduct) return;

        setData('items', [
            ...data.items,
            { product_id: Number(selectedProduct), quantity: 1, unit_cost: 0 }
        ]);
        setSelectedProduct('');
    };

    const handleRemoveItem = (index: number) => {
        setData('items', data.items.filter((_, i) => i !== index));
    };

    const handleUpdateItem = (index: number, field: keyof PurchaseOrderItemInput, value: number) => {
        const newItems = [...data.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setData('items', newItems);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        transform((data) => ({
            ...data,
            exchange_rate: !showExchangeRate ? '1' : data.exchange_rate,
        }));

        post('/inventory/purchase-orders', {
            onError: () => alert('Failed to create purchase order')
        });
    };

    return (
        <AppLayout title="New Purchase Order">
            <Head title="New Purchase Order" />

            <div className="flex flex-col max-w-3xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={() => router.visit('/inventory/purchase-orders')} className="text-zinc-500 hover:text-black dark:hover:text-white text-xl">←</button>
                        <div>
                            <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">New Order</h1>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-10">

                    {/* 1. GENERAL */}
                    <section>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">01. General</h2>

                            <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOrderType('local');
                                        setData('items', []);
                                        setSelectedProduct('');
                                    }}
                                    className={twMerge("px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-colors", orderType === 'local' ? "bg-white dark:bg-black text-black dark:text-white shadow-sm" : "text-zinc-500")}
                                >
                                    Local Order
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOrderType('global');
                                        setData('items', []);
                                        setSelectedProduct('');
                                    }}
                                    className={twMerge("px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-colors", orderType === 'global' ? "bg-white dark:bg-black text-black dark:text-white shadow-sm" : "text-zinc-500")}
                                >
                                    Global Order
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="flex flex-col gap-2">
                                <Label>Batch Name *</Label>
                                <Input
                                    value={data.batch_name}
                                    onChange={(e) => setData('batch_name', e.target.value)}
                                    placeholder="e.g. SEP-001"
                                    required
                                />
                                {errors.batch_name && <span className="text-red-500 text-xs">{errors.batch_name}</span>}
                            </div>

                            {orderType === 'global' ? (
                                <div className="flex flex-col gap-2">
                                    <Label>Supplier *</Label>
                                    <Select value={data.supplier_id} onValueChange={(val) => setData('supplier_id', val ?? '')} required>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Supplier...">
                                                {data.supplier_id ? suppliers.find(s => String(s.id) === data.supplier_id)?.name : null}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {errors.supplier_id && <span className="text-red-500 text-xs">{errors.supplier_id}</span>}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <Label>Shop Name *</Label>
                                    <Input
                                        value={data.shop_name}
                                        onChange={(e) => setData('shop_name', e.target.value)}
                                        placeholder="e.g. Local Electronics Shop"
                                        required
                                    />
                                    {errors.shop_name && <span className="text-red-500 text-xs">{errors.shop_name}</span>}
                                </div>
                            )}
                        </div>

                        {showExchangeRate && (
                            <div className="flex flex-col gap-2">
                                <Label>Exchange Rate (1 {dynamicCurrency} = ? MMK) *</Label>
                                <Input
                                    type="number"
                                    value={data.exchange_rate}
                                    onChange={(e) => setData('exchange_rate', e.target.value)}
                                    placeholder="e.g. 500"
                                    required
                                />
                                {errors.exchange_rate && <span className="text-red-500 text-xs">{errors.exchange_rate}</span>}
                            </div>
                        )}
                    </section>

                    {/* 2. ITEMS */}
                    <section>
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">02. Items ({data.items.length})</h2>

                        <div className="flex items-end gap-4 mb-6">
                            <div className="flex-1 flex flex-col gap-2">
                                <Label>Add Product</Label>
                                <Select value={selectedProduct} onValueChange={(val) => setSelectedProduct(val ?? '')}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a product...">
                                            {selectedProduct ? products.find(p => String(p.id) === selectedProduct)?.name : null}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products.filter(p => p.type === orderType).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button type="button" onClick={handleAddItem} className="h-10 px-8 text-xl">+</Button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {data.items.length === 0 ? (
                                <div className="p-8 bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl items-center flex justify-center">
                                    <span className="text-zinc-400 font-medium text-sm">No items added yet.</span>
                                </div>
                            ) : (
                                data.items.map((item, index) => {
                                    const product = products.find(p => p.id === item.product_id);
                                    return (
                                        <div key={index} className="p-5 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                            <div className="flex justify-between mb-4">
                                                <span className="font-bold text-black dark:text-white uppercase text-sm tracking-wide">
                                                    {product?.name || `Item #${index + 1}`}
                                                </span>
                                                <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-500 font-bold text-xs hover:text-red-600 uppercase">
                                                    Remove
                                                </button>
                                            </div>

                                            <div className="flex gap-4">
                                                <div className="flex-1 flex flex-col gap-2">
                                                    <Label>Qty</Label>
                                                    <Input
                                                        type="number"
                                                        value={item.quantity === 0 ? '' : item.quantity}
                                                        onChange={(e) => handleUpdateItem(index, 'quantity', Number(e.target.value))}
                                                        min="1"
                                                    />
                                                </div>
                                                <div className="flex-1 flex flex-col gap-2">
                                                    <Label>Cost ({dynamicCurrency})</Label>
                                                    <Input
                                                        type="number"
                                                        value={item.unit_cost === 0 ? '' : item.unit_cost}
                                                        onChange={(e) => handleUpdateItem(index, 'unit_cost', Number(e.target.value))}
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </section>

                    {/* 3. PAYMENTS */}
                    <section>
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">03. Payments & Fees</h2>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label>Paid Amount (MMK)</Label>
                                <Input
                                    type="number"
                                    value={data.paid_amount}
                                    onChange={(e) => setData('paid_amount', e.target.value)}
                                    placeholder="0"
                                />
                                <span className="text-xs text-zinc-500 -mt-1">Transfer amount (Deposit)</span>
                            </div>

                            {isForeignOrder && (
                                <div className="flex flex-col gap-2">
                                    <Label>Supplier Service Fee (MMK)</Label>
                                    <Input
                                        type="number"
                                        value={data.supplier_fee}
                                        onChange={(e) => setData('supplier_fee', e.target.value)}
                                        placeholder="0"
                                    />
                                </div>
                            )}

                            <div className="flex flex-col gap-2 mt-4">
                                <Label>Note</Label>
                                <Input
                                    value={data.note}
                                    onChange={(e) => setData('note', e.target.value)}
                                    placeholder="Optional details..."
                                />
                            </div>
                        </div>
                    </section>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <Button type="submit" disabled={processing || data.items.length === 0} className="w-full h-14 tracking-widest uppercase font-bold text-sm">
                            {processing ? "CREATING..." : "CREATE ORDER"}
                        </Button>
                    </div>

                </form>
            </div>
        </AppLayout>
    );
}
