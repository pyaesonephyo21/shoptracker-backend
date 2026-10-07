import React from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Checkbox } from '@/components/ui/checkbox';
import { twMerge } from 'tailwind-merge';

export default function StockAdjustment({ product }: { product: Product }) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        product_variant_id: product.variants?.[0]?.id?.toString() || '',
        reason: 'correction' as 'damage' | 'loss' | 'return' | 'correction',
        action_type: 'add' as 'add' | 'remove',
        quantity: '',
        note: '',
        batch_pricing_mode: 'default' as 'default' | 'existing' | 'new',
        selected_batch_id: '',
        unit_cost: '',
        retail_price: '',
        update_variant_retail_price: false,
    });

    const selectedVariant = product.variants?.find(v => v.id.toString() === data.product_variant_id);
    const variantBatches = selectedVariant?.batches || [];
    const latestBatch = variantBatches[0];
    const defaultUnitCost = latestBatch?.unit_cost ?? 0;
    const defaultRetailPrice = latestBatch?.retail_price ?? selectedVariant?.effective_retail_price ?? product.retail_price ?? 0;

    const selectedExistingBatch = variantBatches.find(b => b.id.toString() === data.selected_batch_id);

    const isActionLocked = data.reason !== 'correction';

    const handleReasonChange = (reason: 'damage' | 'loss' | 'return' | 'correction') => {
        setData(prev => {
            const next = { ...prev, reason };
            if (reason !== 'correction') {
                next.action_type = reason === 'return' ? 'add' : 'remove';
            }
            return next;
        });
    };

    const handleVariantChange = (val: string | null) => {
        setData(prev => ({
            ...prev,
            product_variant_id: val ?? '',
            selected_batch_id: '',
        }));
        clearErrors('product_variant_id');
    };

    const handleModeChange = (mode: 'default' | 'existing' | 'new') => {
        setData(prev => {
            const next = { ...prev, batch_pricing_mode: mode };
            if (mode === 'existing' && !prev.selected_batch_id && variantBatches.length > 0) {
                next.selected_batch_id = variantBatches[0].id.toString();
            }
            return next;
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/inventory/${product.id}/adjust`, {
            preserveScroll: true,
        });
    };

    const ReasonButton = ({ type, label }: { type: typeof data.reason, label: string }) => {
        const isSelected = data.reason === type;
        return (
            <button
                type="button"
                onClick={() => handleReasonChange(type)}
                className={twMerge("flex-1 py-4 px-2 rounded-xl border-2 transition-colors flex items-center justify-center", 
                    isSelected ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-zinc-200 bg-transparent text-zinc-400 dark:border-zinc-800")}
            >
                <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
            </button>
        );
    };

    const ActionToggleButton = ({ type, label }: { type: 'add' | 'remove', label: string }) => {
        const isSelected = data.action_type === type;
        const activeColor = type === 'add' ? "border-green-600 bg-green-600 text-white" : "border-red-600 bg-red-600 text-white";
        const inactiveColor = "border-zinc-200 bg-transparent text-zinc-400 dark:border-zinc-800";
        const opacity = (isActionLocked && !isSelected) ? "opacity-30 cursor-not-allowed" : "opacity-100";

        return (
            <button
                type="button"
                onClick={() => !isActionLocked && setData('action_type', type)}
                disabled={isActionLocked}
                className={twMerge("flex-1 py-4 rounded-xl border-2 transition-all flex items-center justify-center", opacity, isSelected ? activeColor : inactiveColor)}
            >
                <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
            </button>
        );
    };

    const ModeButton = ({ mode, label, sublabel }: { mode: 'default' | 'existing' | 'new', label: string, sublabel?: string }) => {
        const isSelected = data.batch_pricing_mode === mode;
        return (
            <button
                type="button"
                onClick={() => handleModeChange(mode)}
                className={twMerge(
                    "flex-1 p-3 rounded-xl border-2 transition-all flex flex-col items-center justify-center text-center gap-0.5",
                    isSelected
                        ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black shadow-sm"
                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700"
                )}
            >
                <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                {sublabel && (
                    <span className={twMerge("text-[10px]", isSelected ? "text-zinc-300 dark:text-zinc-600" : "text-zinc-400")}>
                        {sublabel}
                    </span>
                )}
            </button>
        );
    };

    const adjustmentQty = parseInt(data.quantity || '0', 10) || 0;

    return (
        <AppLayout title="Adjust Stock">
            <Head title="Adjust Stock" />

            <div className="flex flex-col max-w-xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.visit(`/inventory/${product.id}`)} type="button" className="text-zinc-500 hover:text-black dark:hover:text-white text-xl">←</button>
                        <div>
                            <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">Adjust Stock</h1>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                    
                    {/* Product Info */}
                    <div className="flex flex-col gap-4 p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-black dark:text-white mb-2">{product.name}</h2>
                            <span className="text-sm text-zinc-500">
                                Current Stock: <span className="text-black dark:text-white font-black ml-1">{selectedVariant ? selectedVariant.stock_quantity : 0}</span>
                            </span>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Select Variant</Label>
                            <Select value={data.product_variant_id} onValueChange={handleVariantChange}>
                                <SelectTrigger className="w-full bg-white dark:bg-black h-12">
                                    <SelectValue placeholder="Select a variant...">
                                        {selectedVariant 
                                            ? `${Object.values(selectedVariant.attributes || {}).join(' / ') || 'Default'} (${selectedVariant.sku}) ${selectedVariant.deleted_at ? '(Archived)' : ''}`
                                            : "Select a variant..."}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    {product.variants?.map(v => (
                                        <SelectItem key={v.id} value={v.id.toString()}>
                                            {Object.values(v.attributes || {}).join(' / ') || 'Default'} ({v.sku}) {v.deleted_at ? '(Archived)' : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.product_variant_id && <span className="text-red-500 text-xs">{errors.product_variant_id}</span>}
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Reason</Label>
                        <div className="flex flex-wrap gap-3">
                            <ReasonButton type="damage" label="Damage" />
                            <ReasonButton type="loss" label="Loss" />
                            <ReasonButton type="return" label="Return" />
                            <ReasonButton type="correction" label="Correction" />
                        </div>
                        {errors.reason && <span className="text-red-500 text-xs">{errors.reason}</span>}
                    </div>

                    <div className="flex flex-col gap-3">
                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">Impact</Label>
                        <div className="flex gap-4">
                            <ActionToggleButton type="add" label="+ Add Stock" />
                            <ActionToggleButton type="remove" label="- Remove Stock" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Quantity (Positive Number)</Label>
                        <Input
                            type="number"
                            value={data.quantity}
                            onChange={(e) => { setData('quantity', e.target.value); clearErrors('quantity'); }}
                            placeholder="e.g. 1"
                            min="1"
                            autoFocus
                        />
                        <span className="text-xs text-zinc-500 mt-1">
                            This will {data.action_type === "add" ? "ADD" : "REMOVE"} {data.quantity || 0} items.
                        </span>
                        {errors.quantity && <span className="text-red-500 text-xs">{errors.quantity}</span>}
                    </div>

                    {/* Batch Pricing & Allocation (Only for Adding Stock) */}
                    {data.action_type === 'add' && (
                        <div className="flex flex-col gap-5 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/50">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between gap-2">
                                    <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                                        Batch Allocation & Pricing
                                    </h3>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                        No Cashflow Impact
                                    </span>
                                </div>
                                <p className="text-[11px] text-zinc-500">
                                    Top up an existing batch or generate a brand new batch. Zero cash is deducted from finance.
                                </p>
                            </div>

                            {/* Mode Selector */}
                            <div className="flex flex-col sm:flex-row gap-2">
                                <ModeButton 
                                    mode="default" 
                                    label="Default" 
                                    sublabel={latestBatch ? "Top up latest" : "Initial batch"} 
                                />
                                <ModeButton 
                                    mode="existing" 
                                    label="Existing Batch" 
                                    sublabel={variantBatches.length > 0 ? "Top up chosen" : "None"} 
                                />
                                <ModeButton 
                                    mode="new" 
                                    label="New Batch" 
                                    sublabel="Create new batch" 
                                />
                            </div>

                            {/* Mode 1: Default */}
                            {data.batch_pricing_mode === 'default' && (
                                <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5 text-xs">
                                    {latestBatch ? (
                                        <>
                                            <div className="flex items-center justify-between bg-zinc-100/60 dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                                                <span className="text-zinc-600 dark:text-zinc-400">Target Batch:</span>
                                                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                                    Batch #{latestBatch.id}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-900">
                                                <span className="text-zinc-500">Batch Stock Level</span>
                                                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                                    {latestBatch.remaining_quantity} left → <strong className="text-green-600 font-bold">{latestBatch.remaining_quantity + adjustmentQty} left</strong>
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-900">
                                                <span className="text-zinc-500">Base Cost / Unit</span>
                                                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                                    {defaultUnitCost > 0 ? `${Math.round(defaultUnitCost).toLocaleString()} MMK` : '0 MMK'}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center py-1">
                                                <span className="text-zinc-500">Retail Price / Unit</span>
                                                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                                    {defaultRetailPrice > 0 ? `${Math.round(defaultRetailPrice).toLocaleString()} MMK` : '0 MMK'}
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-zinc-400 mt-1">
                                                Adds +{adjustmentQty} pcs directly to the latest batch without creating duplicate batch rows.
                                            </span>
                                        </>
                                    ) : (
                                        <div className="text-zinc-500 py-1">
                                            No previous batches exist. A new initial batch will be created with default catalog pricing.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Mode 2: Existing Batch Selection */}
                            {data.batch_pricing_mode === 'existing' && (
                                <div className="flex flex-col gap-3">
                                    {variantBatches.length > 0 ? (
                                        <>
                                            <div className="flex flex-col gap-1.5">
                                                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                    Select Batch to Top Up
                                                </Label>
                                                <Select
                                                    value={data.selected_batch_id}
                                                    onValueChange={(val) => { setData('selected_batch_id', val ?? ''); clearErrors('selected_batch_id'); }}
                                                >
                                                    <SelectTrigger className="w-full bg-white dark:bg-zinc-950 h-12">
                                                        <SelectValue placeholder="Choose a batch...">
                                                            {selectedExistingBatch ? (
                                                                `Batch #${selectedExistingBatch.id} • ${Math.round(selectedExistingBatch.unit_cost).toLocaleString()} MMK cost • ${new Date(selectedExistingBatch.created_at).toLocaleDateString()}`
                                                            ) : "Choose a batch..."}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {variantBatches.map(b => {
                                                            const sourceLabel = b.reference?.batch_name
                                                                ? `PO: ${b.reference.batch_name}`
                                                                : (b.reference_type?.includes('StockAdjustment') ? 'Adjustment' : `Batch #${b.id}`);
                                                            return (
                                                                <SelectItem key={b.id} value={b.id.toString()}>
                                                                    Batch #{b.id} ({sourceLabel}) • {Math.round(b.unit_cost).toLocaleString()} MMK cost • {b.remaining_quantity}/{b.initial_quantity} left
                                                                </SelectItem>
                                                            );
                                                        })}
                                                    </SelectContent>
                                                </Select>
                                                {errors.selected_batch_id && <span className="text-red-500 text-xs">{errors.selected_batch_id}</span>}
                                            </div>

                                            {selectedExistingBatch && (
                                                <div className="p-4 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5 text-xs">
                                                    <div className="flex items-center justify-between bg-zinc-100/60 dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800">
                                                        <span className="text-zinc-600 dark:text-zinc-400">Target Batch:</span>
                                                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                                            Batch #{selectedExistingBatch.id} ({new Date(selectedExistingBatch.created_at).toLocaleDateString()})
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-900">
                                                        <span className="text-zinc-500">Batch Stock Level</span>
                                                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                                                            {selectedExistingBatch.remaining_quantity} left → <strong className="text-green-600 font-bold">{selectedExistingBatch.remaining_quantity + adjustmentQty} left</strong>
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1 border-b border-zinc-100 dark:border-zinc-900">
                                                        <span className="text-zinc-500">Unit Base Cost</span>
                                                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                                            {Math.round(selectedExistingBatch.unit_cost).toLocaleString()} MMK
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-1">
                                                        <span className="text-zinc-500">Retail Price</span>
                                                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                                                            {selectedExistingBatch.retail_price 
                                                                ? `${Math.round(selectedExistingBatch.retail_price).toLocaleString()} MMK` 
                                                                : `${Math.round(defaultRetailPrice).toLocaleString()} MMK (Default)`}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] text-zinc-400 mt-1">
                                                        Directly increments the remaining quantity of Batch #{selectedExistingBatch.id}.
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
                                            No past batches exist for this variant. Please use <strong>Default</strong> or <strong>New Batch</strong> mode.
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Mode 3: New Batch Creation */}
                            {data.batch_pricing_mode === 'new' && (
                                <div className="flex flex-col gap-4">
                                    <div className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300">
                                        Creates a brand new batch record with custom pricing for accurate future FIFO profit calculations.
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <Label htmlFor="unit_cost" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                    Base Cost / Unit (MMK)
                                                </Label>
                                                {defaultUnitCost > 0 && (
                                                    <span className="text-[10px] text-zinc-400">
                                                        Ref: {Math.round(defaultUnitCost).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            <FormattedNumberInput
                                                id="unit_cost"
                                                value={data.unit_cost}
                                                onChange={(val) => { setData('unit_cost', val); clearErrors('unit_cost'); }}
                                                placeholder="e.g. 15,000"
                                                className="bg-white dark:bg-zinc-950 h-12"
                                            />
                                            {errors.unit_cost && <span className="text-red-500 text-xs">{errors.unit_cost}</span>}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <div className="flex justify-between items-center">
                                                <Label htmlFor="retail_price" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                                                    Retail Price / Unit (MMK)
                                                </Label>
                                                {defaultRetailPrice > 0 && (
                                                    <span className="text-[10px] text-zinc-400">
                                                        Ref: {Math.round(defaultRetailPrice).toLocaleString()}
                                                    </span>
                                                )}
                                            </div>
                                            <FormattedNumberInput
                                                id="retail_price"
                                                value={data.retail_price}
                                                onChange={(val) => { setData('retail_price', val); clearErrors('retail_price'); }}
                                                placeholder="e.g. 25,000"
                                                className="bg-white dark:bg-zinc-950 h-12"
                                            />
                                            {errors.retail_price && <span className="text-red-500 text-xs">{errors.retail_price}</span>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Option to also update variant catalog retail price */}
                            <label className="flex items-center gap-3 pt-2 cursor-pointer select-none">
                                <Checkbox
                                    checked={data.update_variant_retail_price}
                                    onCheckedChange={(checked) => setData('update_variant_retail_price', !!checked)}
                                />
                                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Also update variant's default selling price
                                </span>
                            </label>
                        </div>
                    )}

                    <div className="flex flex-col gap-2">
                        <Label>Note (Optional)</Label>
                        <Input
                            value={data.note}
                            onChange={(e) => { setData('note', e.target.value); clearErrors('note'); }}
                            placeholder="e.g. Delayed old batch arrival, stocktake count"
                        />
                        {errors.note && <span className="text-red-500 text-xs">{errors.note}</span>}
                    </div>

                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 mt-4">
                        <Button type="submit" disabled={processing || !data.quantity} variant={data.action_type === 'add' ? 'default' : 'destructive'} className="w-full h-14 tracking-widest uppercase font-bold text-sm">
                            {processing ? "PROCESSING..." : "CONFIRM ADJUSTMENT"}
                        </Button>
                    </div>

                </form>
            </div>
        </AppLayout>
    );
}
