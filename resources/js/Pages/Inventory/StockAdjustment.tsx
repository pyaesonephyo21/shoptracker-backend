import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Product } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { twMerge } from 'tailwind-merge';

export default function StockAdjustment({ product }: { product: Product }) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        product_variant_id: product.variants?.[0]?.id?.toString() || '',
        reason: 'correction' as 'damage' | 'loss' | 'return' | 'correction',
        action_type: 'add' as 'add' | 'remove',
        quantity: '',
        note: ''
    });

    const selectedVariant = product.variants?.find(v => v.id.toString() === data.product_variant_id);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/inventory/${product.id}/adjust`, {
            preserveScroll: true,
            onError: () => alert('Failed to adjust stock')
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
                            <Select value={data.product_variant_id} onValueChange={(val) => setData('product_variant_id', val ?? '')}>
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

                    <div className="flex flex-col gap-2">
                        <Label>Note (Optional)</Label>
                        <Input
                            value={data.note}
                            onChange={(e) => { setData('note', e.target.value); clearErrors('note'); }}
                            placeholder="e.g. Count error"
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
