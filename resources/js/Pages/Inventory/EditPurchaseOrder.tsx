import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableSelect } from '@/components/SearchableSelect';
import { Product, PurchaseOrderItemInput } from '@/types/inventory';
import { twMerge } from 'tailwind-merge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface Supplier {
    id: number;
    name: string;
    currency: string;
}

export default function EditPurchaseOrder({ order, products = [], suppliers = [], currencyLabel = "CNY", isForeignOrder = true }: { order: any, products: Product[], suppliers: Supplier[], currencyLabel: string, isForeignOrder: boolean }) {
    const initialOrderType = order.supplier_id ? 'global' : 'local';
    const [orderType, setOrderType] = useState<'local' | 'global'>(initialOrderType);

    const { data, setData, put, transform, processing, errors, clearErrors } = useForm<{
        batch_name: string;
        supplier_id: string;
        shop_name: string;
        exchange_rate: string | number;
        items: PurchaseOrderItemInput[];
        foreign_deli_fee: string | number;
        supplier_fee_percentage: string | number;
        paid_amount: string | number;
        note: string;
    }>({
        batch_name: order.batch_name || '',
        supplier_id: order.supplier_id ? String(order.supplier_id) : '',
        shop_name: order.local_shop_name || '',
        exchange_rate: order.exchange_rate ? String(order.exchange_rate) : '',
        items: (order.items || []).map((item: any) => ({
            product_variant_id: item.product_variant_id,
            quantity: item.quantity,
            unit_cost: item.original_cost || '',
            retail_price: item.retail_price || ''
        })) as PurchaseOrderItemInput[],
        foreign_deli_fee: order.foreign_deli_fee ? String(order.foreign_deli_fee) : '',
        supplier_fee_percentage: order.supplier_fee_percentage ? String(order.supplier_fee_percentage) : '',
        paid_amount: order.paid_amount ? String(order.paid_amount) : '',
        note: order.note || ''
    });

    const selectedSupplier = suppliers.find(s => String(s.id) === data.supplier_id);
    const dynamicCurrency = orderType === 'local' ? 'MMK' : (selectedSupplier?.currency || currencyLabel);
    const showExchangeRate = orderType === 'global' && dynamicCurrency !== 'MMK';

    const [selectedProduct, setSelectedProduct] = useState<string>('');

    const [modalOpen, setModalOpen] = useState(false);
    const [activeProduct, setActiveProduct] = useState<Product | null>(null);
    const [defaultQuantity, setDefaultQuantity] = useState<number | ''>('');
    const [defaultUnitCost, setDefaultUnitCost] = useState<number | ''>('');
    const [defaultRetailPrice, setDefaultRetailPrice] = useState<number | ''>('');
    const [selectedVariantIds, setSelectedVariantIds] = useState<number[]>([]);

    // Computations
    const totalGoodsCost = data.items.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)), 0);
    const exchangeRate = Number(data.exchange_rate) || 1;
    const foreignDeliFee = Number(data.foreign_deli_fee) || 0;
    const supplierFeePercent = Number(data.supplier_fee_percentage) || 0;
    
    const calculatedSupplierFee = orderType === 'global' ? ((totalGoodsCost + foreignDeliFee) * (supplierFeePercent / 100)) : 0;
    const totalForeignCurrency = totalGoodsCost + foreignDeliFee + calculatedSupplierFee;
    const grandTotalMMK = orderType === 'global' ? (totalForeignCurrency * exchangeRate) : totalGoodsCost;

    const openProductModal = () => {
        if (!selectedProduct) return;
        const product = products.find(p => String(p.id) === selectedProduct);
        if (!product || !product.variants) return;

        setActiveProduct(product);
        setDefaultQuantity('');
        setDefaultUnitCost(product.base_cost || '');
        setDefaultRetailPrice(product.retail_price || '');
        setSelectedVariantIds(product.variants.map(v => v.id));
        setModalOpen(true);
    };

    const confirmAddVariants = () => {
        if (!activeProduct || !activeProduct.variants) return;

        const variantsToAdd = activeProduct.variants.filter(v => selectedVariantIds.includes(v.id));

        const newItems = variantsToAdd.map(v => ({
            product_variant_id: v.id,
            quantity: defaultQuantity,
            unit_cost: defaultUnitCost,
            retail_price: defaultRetailPrice
        }));

        const itemsToAdd = newItems.filter(newItem => 
            !data.items.some(existing => existing.product_variant_id === newItem.product_variant_id)
        );

        setData('items', [
            ...data.items,
            ...itemsToAdd
        ]);

        setModalOpen(false);
        setSelectedProduct('');
        setActiveProduct(null);
    };

    const toggleVariantSelection = (id: number) => {
        setSelectedVariantIds(prev => 
            prev.includes(id) ? prev.filter(vId => vId !== id) : [...prev, id]
        );
    };

    const handleRemoveItem = (index: number) => {
        setData('items', data.items.filter((_, i) => i !== index));
    };

    const handleUpdateItem = (index: number, field: keyof PurchaseOrderItemInput, value: number | '') => {
        const newItems = [...data.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setData('items', newItems);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        transform((currentData) => ({
            ...currentData,
            order_type: orderType,
            exchange_rate: !showExchangeRate ? '1' : currentData.exchange_rate,
            supplier_id: orderType === 'local' ? null : (currentData.supplier_id || null),
            shop_name: orderType === 'global' ? null : (currentData.shop_name || null),
            items: currentData.items.filter(item => Number(item.quantity) > 0)
        }));

        put(`/inventory/purchase-orders/${order.id}`, {
            preserveScroll: true,
            onError: (err) => {
                if (Object.keys(err).length === 0) {
                    alert('Failed to update purchase order');
                }
            }
        });
    };

    return (
        <AppLayout title={`Edit Purchase Order #${order.id}`}>
            <Head title={`Edit Purchase Order #${order.id}`} />

            <div className="flex flex-col max-w-3xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={() => router.visit(`/inventory/purchase-orders/${order.id}`)} className="text-zinc-500 hover:text-black dark:hover:text-white text-xl">←</button>
                        <div>
                            <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">Edit Order #{order.id}</h1>
                        </div>
                    </div>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-8 text-yellow-800 dark:text-yellow-200 text-sm font-medium flex gap-3 items-center">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Warning: Changing items or quantities will recalculate the pending stock. You cannot reduce quantities if doing so would strand pending sales orders!</span>
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
                                    }}
                                    className={twMerge("px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-colors", orderType === 'local' ? "bg-white dark:bg-black text-black dark:text-white shadow-sm" : "text-zinc-500")}
                                >
                                    Local Order
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOrderType('global');
                                    }}
                                    className={twMerge("px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-colors", orderType === 'global' ? "bg-white dark:bg-black text-black dark:text-white shadow-sm" : "text-zinc-500")}
                                >
                                    Global Order
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="flex flex-col gap-2">
                                <Label>Batch Name</Label>
                                <Input
                                    value={data.batch_name}
                                    onChange={(e) => { setData('batch_name', e.target.value); clearErrors('batch_name'); }}
                                    placeholder="e.g. SEP-001"
                                />
                                {errors.batch_name && <span className="text-red-500 text-xs">{errors.batch_name}</span>}
                            </div>

                            {orderType === 'global' ? (
                                <div className="flex flex-col gap-2">
                                    <Label>Supplier</Label>
                                    <Select value={data.supplier_id} onValueChange={(val) => setData('supplier_id', val ?? '')}>
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
                                    <Label>Shop Name</Label>
                                    <Input
                                        value={data.shop_name}
                                        onChange={(e) => { setData('shop_name', e.target.value); clearErrors('shop_name'); }}
                                        placeholder="e.g. Local Electronics Shop"
                                    />
                                    {errors.shop_name && <span className="text-red-500 text-xs">{errors.shop_name}</span>}
                                </div>
                            )}
                        </div>

                        {showExchangeRate && (
                            <>
                                <div className="flex flex-col gap-2">
                                    <Label>Exchange Rate (1 {dynamicCurrency} = ? MMK)</Label>
                                    <FormattedNumberInput
                                        value={data.exchange_rate}
                                        onChange={(val) => { setData('exchange_rate', val); clearErrors('exchange_rate'); }}
                                        placeholder="e.g. 500"
                                    />
                                    {errors.exchange_rate && <span className="text-red-500 text-xs">{errors.exchange_rate}</span>}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>China Domestic Shipping ({dynamicCurrency}) (Optional)</Label>
                                    <FormattedNumberInput
                                        value={data.foreign_deli_fee}
                                        onChange={(val) => { setData('foreign_deli_fee', val); clearErrors('foreign_deli_fee'); }}
                                        placeholder="e.g. 15"
                                    />
                                    {/* @ts-ignore */}
                                    {errors.foreign_deli_fee && <span className="text-red-500 text-xs">{errors.foreign_deli_fee}</span>}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>Supplier Service Fee (%) (Optional)</Label>
                                    <FormattedNumberInput
                                        value={data.supplier_fee_percentage}
                                        onChange={(val) => { setData('supplier_fee_percentage', val); clearErrors('supplier_fee_percentage'); }}
                                        placeholder="e.g. 3"
                                    />
                                    {/* @ts-ignore */}
                                    {errors.supplier_fee_percentage && <span className="text-red-500 text-xs">{errors.supplier_fee_percentage}</span>}
                                </div>
                            </>
                        )}
                    </section>

                    {/* 2. ITEMS */}
                    <section>
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">02. Items ({data.items.length})</h2>

                        <div className="flex items-end gap-4 mb-6">
                            <div className="flex-1 flex flex-col gap-2">
                                <Label>Add Product</Label>
                                <SearchableSelect 
                                    value={selectedProduct} 
                                    onValueChange={(val) => setSelectedProduct(val)}
                                    options={products.filter(p => p.type === orderType).map(p => ({
                                        label: p.name,
                                        value: String(p.id)
                                    }))}
                                    placeholder="Select a product to add all variants..."
                                    className="h-12"
                                    listClassName="max-h-80"
                                />
                            </div>
                            <Button type="button" onClick={openProductModal} className="h-12 px-8 text-xl">+</Button>
                        </div>

                        <div className="flex flex-col gap-4">
                            {data.items.length === 0 ? (
                                <div className="p-8 bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl items-center flex justify-center">
                                    <span className="text-zinc-400 font-medium text-sm">No items added yet.</span>
                                </div>
                            ) : (
                                data.items.map((item, index) => {
                                    let variantName = `Item #${index + 1}`;
                                    for (const p of products) {
                                        const v = p.variants?.find(v => v.id === item.product_variant_id);
                                        if (v) {
                                            variantName = `${p.name} - ${Object.values(v.attributes || {}).join(' / ') || 'Default'}`;
                                            break;
                                        }
                                    }
                                    return (
                                        <div key={index} className="p-5 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                                            <div className="flex justify-between mb-4">
                                                <span className="font-bold text-black dark:text-white uppercase text-sm tracking-wide">
                                                    {variantName}
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
                                                        value={item.quantity}
                                                        onChange={(e) => { handleUpdateItem(index, 'quantity', e.target.value === '' ? '' : Number(e.target.value)); clearErrors(`items.${index}.quantity` as any); }}
                                                        min="1"
                                                    />
                                                    {errors[`items.${index}.quantity` as keyof typeof errors] && <span className="text-red-500 text-xs">{errors[`items.${index}.quantity` as keyof typeof errors]}</span>}
                                                </div>
                                                <div className="flex-1 flex flex-col gap-2">
                                                    <Label>Unit Cost ({dynamicCurrency})</Label>
                                                    <FormattedNumberInput
                                                        value={item.unit_cost}
                                                        onChange={(val) => { handleUpdateItem(index, 'unit_cost', val === '' ? '' : Number(val)); clearErrors(`items.${index}.unit_cost` as any); }}
                                                    />
                                                    {errors[`items.${index}.unit_cost` as keyof typeof errors] && <span className="text-red-500 text-xs">{errors[`items.${index}.unit_cost` as keyof typeof errors]}</span>}
                                                </div>
                                                <div className="flex-1 flex flex-col gap-2">
                                                    <Label className="truncate whitespace-nowrap">Retail Price <span className="text-[10px] text-zinc-400 font-normal ml-0.5">(Opt)</span></Label>
                                                    <FormattedNumberInput
                                                        value={item.retail_price}
                                                        onChange={(val) => { handleUpdateItem(index, 'retail_price', val === '' ? '' : Number(val)); clearErrors(`items.${index}.retail_price` as any); }}
                                                    />
                                                    {errors[`items.${index}.retail_price` as keyof typeof errors] && <span className="text-red-500 text-xs">{errors[`items.${index}.retail_price` as keyof typeof errors]}</span>}
                                                </div>
                                            </div>

                                            {/* INLINE SUBTOTAL */}
                                            <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Subtotal</span>
                                                <span className="font-black text-sm">{(Number(item.quantity || 0) * Number(item.unit_cost || 0)).toLocaleString()} {dynamicCurrency}</span>
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
                                <Label>Paid Amount (MMK) <span className="text-[10px] text-zinc-400 font-normal ml-0.5">(Deposit, Optional)</span></Label>
                                <FormattedNumberInput
                                    value={data.paid_amount}
                                    onChange={(val) => { setData('paid_amount', val); clearErrors('paid_amount'); }}
                                    placeholder="0"
                                />
                            </div>

                            <div className="flex flex-col gap-2 mt-2">
                                <Label>Note (Optional)</Label>
                                <Input
                                    value={data.note}
                                    onChange={(e) => { setData('note', e.target.value); clearErrors('note'); }}
                                    placeholder="Optional details..."
                                />
                            </div>
                        </div>

                        {/* ORDER SUMMARY */}
                        <div className="mt-8 bg-zinc-100 dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                            <h3 className="text-sm font-black uppercase tracking-widest mb-4">Order Summary</h3>
                            <div className="flex flex-col gap-2 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-zinc-500">Total Goods:</span>
                                    <span className="font-bold">{totalGoodsCost.toLocaleString()} {dynamicCurrency}</span>
                                </div>
                                {orderType === 'global' && Number(data.foreign_deli_fee || 0) > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-zinc-500">Foreign Shipping:</span>
                                        <span className="font-bold">{Number(data.foreign_deli_fee || 0).toLocaleString()} {dynamicCurrency}</span>
                                    </div>
                                )}
                                {orderType === 'global' && Number(data.supplier_fee_percentage || 0) > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-zinc-500">Supplier Fee ({data.supplier_fee_percentage}%):</span>
                                        <span className="font-bold">{calculatedSupplierFee.toLocaleString()} {dynamicCurrency}</span>
                                    </div>
                                )}
                                <div className="border-t border-zinc-200 dark:border-zinc-800 my-2"></div>
                                {orderType === 'global' ? (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex justify-between items-center">
                                            <span className="text-zinc-500">Total (Foreign):</span>
                                            <span className="font-bold">{totalForeignCurrency.toLocaleString()} {dynamicCurrency}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-lg mt-1">
                                            <span className="font-black text-black dark:text-white uppercase tracking-wider">Grand Total:</span>
                                            <span className="font-black text-green-600 dark:text-green-500">{Math.round(grandTotalMMK).toLocaleString()} MMK</span>
                                        </div>
                                        <div className="flex justify-end mt-1">
                                            <span className="text-[10px] text-zinc-400 font-bold tracking-widest uppercase">Rate: 1 {dynamicCurrency} = {exchangeRate} MMK</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-between items-center text-lg mt-1">
                                        <span className="font-black text-black dark:text-white uppercase tracking-wider">Grand Total:</span>
                                        <span className="font-black text-green-600 dark:text-green-500">{Math.round(grandTotalMMK).toLocaleString()} MMK</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                        <Button type="submit" disabled={processing || data.items.length === 0} className="w-full h-14 tracking-widest uppercase font-bold text-sm">
                            {processing ? "SAVING..." : "SAVE CHANGES"}
                        </Button>
                    </div>

                </form>
            </div>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add {activeProduct?.name}</DialogTitle>
                    </DialogHeader>

                    <div className="flex flex-col gap-6 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label>Default Unit Cost</Label>
                                <FormattedNumberInput
                                    value={defaultUnitCost}
                                    onChange={(val) => setDefaultUnitCost(val === '' ? '' : Number(val))}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label>Default Retail Price</Label>
                                <FormattedNumberInput
                                    value={defaultRetailPrice}
                                    onChange={(val) => setDefaultRetailPrice(val === '' ? '' : Number(val))}
                                />
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            <Label>Default Quantity</Label>
                            <Input
                                type="number"
                                value={defaultQuantity}
                                onChange={(e) => setDefaultQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder="e.g. 10"
                            />
                        </div>

                        <div className="flex flex-col gap-3">
                            <Label>Select Variants</Label>
                            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg max-h-60 overflow-y-auto p-2 flex flex-col gap-1 bg-zinc-50 dark:bg-zinc-900">
                                {activeProduct?.variants?.map(v => {
                                    const isSelected = selectedVariantIds.includes(v.id);
                                    const attributesLabel = Object.values(v.attributes || {}).join(' / ') || 'Default';
                                    return (
                                        <label key={v.id} className="flex items-center gap-3 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded cursor-pointer transition-colors">
                                            <Checkbox 
                                                checked={isSelected}
                                                onCheckedChange={() => toggleVariantSelection(v.id)}
                                            />
                                            <span className="text-sm font-medium">{attributesLabel}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                        <Button onClick={confirmAddVariants} disabled={selectedVariantIds.length === 0}>
                            Add {selectedVariantIds.length} Variants
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
