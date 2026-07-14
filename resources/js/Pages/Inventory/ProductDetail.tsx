import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { Product, InventoryLog } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { twMerge } from 'tailwind-merge';

export default function ProductDetail({ product, latestCost, latestRetailPrice, pendingCost }: { product: Product, latestCost: number, latestRetailPrice: number, pendingCost: number }) {
    const [activeTab, setActiveTab] = useState<'activity' | 'batches'>('activity');
    const [activeVariantTab, setActiveVariantTab] = useState<'active' | 'archived'>('active');
    const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

    const [editingRetailPriceId, setEditingRetailPriceId] = useState<number | null>(null);
    const [editRetailPriceValue, setEditRetailPriceValue] = useState<string>('');
    const [isSavingRetailPrice, setIsSavingRetailPrice] = useState(false);

    const stock = product.variants?.filter(v => !v.deleted_at).reduce((acc, v) => acc + (v.stock_quantity || 0), 0) || 0;
    const pendingStock = product.variants?.filter(v => !v.deleted_at).reduce((acc, v) => acc + (v.pending_stock || 0), 0) || 0;

    const formatMMK = (val: number) => Math.round(Number(val)).toLocaleString();

    const activeVariants = product.variants?.filter(v => !v.deleted_at) || [];
    const retailPrices = activeVariants.map(v => Number(v.retail_price || product.retail_price || 0));

    let displayRetailPrice = formatMMK(product.retail_price || 0);
    if (retailPrices.length > 0) {
        const minRetailPrice = Math.min(...retailPrices);
        const maxRetailPrice = Math.max(...retailPrices);
        displayRetailPrice = minRetailPrice === maxRetailPrice
            ? formatMMK(minRetailPrice)
            : `${formatMMK(minRetailPrice)} ~ ${formatMMK(maxRetailPrice)}`;
    }

    const formatReason = (reason: string) => {
        switch (reason) {
            case "purchase_arrived": return "Stock Arrived";
            case "sale_sold": return "Item Sold";
            case "adjustment_damage": return "Damaged";
            case "adjustment_loss": return "Lost";
            case "adjustment_return": return "Return";
            case "adjustment_correction": return "Correction";
            default: return reason.replace("_", " ");
        }
    };

    const handleToggleActive = () => {
        router.post(`/inventory/${product.id}/toggle-active`, {}, {
            onSuccess: () => setIsArchiveDialogOpen(false)
        });
    };

    const handleRestoreVariant = (variantId: number) => {
        router.post(`/inventory/variants/${variantId}/restore`, {}, {
            preserveScroll: true
        });
    };

    const handleSaveRetailPrice = async (variantId: number) => {
        if (!editRetailPriceValue || isSavingRetailPrice) return;
        setIsSavingRetailPrice(true);

        try {
            await axios.put(`/inventory/variants/${variantId}/retail-price`, {
                retail_price: editRetailPriceValue
            }, {
                headers: { 'Accept': 'application/json' }
            });

            if (product.variants) {
                const variant = product.variants.find(v => v.id === variantId);
                if (variant) {
                    variant.retail_price = Number(editRetailPriceValue);
                }
            }

            setEditingRetailPriceId(null);
            setEditRetailPriceValue('');
            setIsSavingRetailPrice(false);
        } catch (error) {
            console.error('Failed to save retail price', error);
            setIsSavingRetailPrice(false);
        }
    };

    return (
        <AppLayout title={product.name}>
            <Head title={product.name} />

            <div className="flex flex-col max-w-4xl mx-auto w-full pb-20">

                {/* Header */}
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.visit('/inventory')} className="text-zinc-500 hover:text-black dark:hover:text-white text-xl">←</button>
                        <div>
                            <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">Product Details</h1>
                        </div>
                    </div>
                    <div className="flex gap-4 items-center">
                        <Button onClick={() => router.visit(`/inventory/${product.id}/edit`)} className="text-xs font-bold uppercase tracking-widest">
                            EDIT
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        {/* HERO */}
                        <div className={twMerge("p-6 rounded-2xl border items-center flex flex-col text-center relative overflow-hidden", product.is_active ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-100 dark:border-zinc-800" : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 opacity-80")}>
                            {!product.is_active && (
                                <div className="absolute top-0 right-0 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl border-l border-b border-red-200 dark:border-red-900/50">
                                    Archived
                                </div>
                            )}
                            <div className="w-24 h-24 bg-white dark:bg-black rounded-2xl mb-4 items-center justify-center shadow-sm flex">
                                <span className="text-4xl">📦</span>
                            </div>
                            <h2 className={twMerge("text-2xl font-black mb-6", product.is_active ? "text-black dark:text-white" : "text-zinc-500 line-through decoration-zinc-300 dark:decoration-zinc-600")}>
                                {product.name}
                            </h2>

                            <Button
                                variant={product.is_active ? "outline" : "default"}
                                className={twMerge("w-full text-xs font-bold uppercase tracking-widest", !product.is_active && "bg-green-600 hover:bg-green-700 text-white border-transparent")}
                                onClick={() => setIsArchiveDialogOpen(true)}
                            >
                                {product.is_active ? 'ARCHIVE PRODUCT' : 'RESTORE PRODUCT'}
                            </Button>
                        </div>

                        {/* STATS */}
                        <div className="p-6 bg-black dark:bg-white rounded-2xl shadow-sm flex items-center justify-between">
                            <div className="flex-1 flex flex-col items-center">
                                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">In Stock</span>
                                <span className={twMerge("text-3xl lg:text-4xl font-black", stock <= 0 ? "text-red-500" : "text-white dark:text-black")}>{stock}</span>
                            </div>
                            <div className="w-px h-16 bg-zinc-800 dark:bg-zinc-200" />
                            <div className="flex-1 flex flex-col items-center">
                                <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Pending</span>
                                <span className="text-3xl lg:text-4xl font-black text-zinc-400">{pendingStock}</span>
                                {pendingCost > 0 && (
                                    <span className="text-[10px] font-bold text-zinc-500 mt-1">Est. {formatMMK(pendingCost)} MMK/ea</span>
                                )}
                            </div>
                        </div>

                        {/* FINANCIALS */}
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <div className="flex justify-between mb-4">
                                <span className="text-sm font-medium text-zinc-500">Retail Price</span>
                                <span className="text-sm font-bold text-black dark:text-white">{displayRetailPrice} MMK</span>
                            </div>
                            <div className="flex justify-between mb-6">
                                <span className="text-sm font-medium text-zinc-500">Cost Price <span className="text-[10px] text-zinc-400">(Latest)</span></span>
                                <span className="text-sm font-bold text-black dark:text-white">{formatMMK(latestCost || 0)} MMK</span>
                            </div>

                            <Button onClick={() => router.visit(`/inventory/${product.id}/adjust`)} variant="outline" className="w-full h-12 tracking-widest uppercase font-bold bg-white dark:bg-black">
                                ADJUST STOCK
                            </Button>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-2 flex flex-col gap-6">

                        {/* VARIANTS */}
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Variants ({product.variants?.filter(v => activeVariantTab === 'active' ? !v.deleted_at : v.deleted_at).length || 0})</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActiveVariantTab('active')}
                                        className={twMerge("text-xs font-bold uppercase px-3 py-1.5 rounded-lg transition-colors", activeVariantTab === 'active' ? "bg-black text-white dark:bg-white dark:text-black" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400")}
                                    >
                                        Active
                                    </button>
                                    <button
                                        onClick={() => setActiveVariantTab('archived')}
                                        className={twMerge("text-xs font-bold uppercase px-3 py-1.5 rounded-lg transition-colors", activeVariantTab === 'archived' ? "bg-black text-white dark:bg-white dark:text-black" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400")}
                                    >
                                        Archived
                                    </button>
                                </div>
                            </div>
                            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-[10px] sm:text-xs uppercase text-zinc-500 font-bold">
                                        <tr>
                                            <th className="px-2 sm:px-4 py-3">Variant</th>
                                            <th className="px-2 sm:px-4 py-3">SKU</th>
                                            {activeVariantTab === 'active' ? (
                                                <>
                                                    <th className="px-2 sm:px-4 py-3 text-right">Stock</th>
                                                    <th className="px-2 sm:px-4 py-3 text-right">
                                                        <span className="hidden sm:inline">Retail Price</span>
                                                        <span className="sm:hidden">Price</span>
                                                    </th>
                                                </>
                                            ) : (
                                                    <th className="px-2 sm:px-4 py-3 text-right">Action</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {product.variants?.filter(v => activeVariantTab === 'active' ? !v.deleted_at : v.deleted_at).map(v => (
                                            <tr key={v.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 bg-white dark:bg-black">
                                                <td className="px-2 sm:px-4 py-3 font-medium whitespace-nowrap">
                                                    {Object.values(v.attributes || {}).join(' / ') || 'Default'}
                                                </td>
                                                <td className="px-2 sm:px-4 py-3 text-zinc-500 whitespace-nowrap">{v.sku}</td>
                                                {activeVariantTab === 'active' ? (
                                                    <>
                                                        <td className="px-2 sm:px-4 py-3 text-right whitespace-nowrap">
                                                            <span className={twMerge("font-bold", v.stock_quantity > 0 ? "text-green-600 dark:text-green-500" : "text-red-500")}>
                                                                {v.stock_quantity}
                                                            </span>
                                                            {v.pending_stock > 0 && <span className="text-zinc-400 ml-1">(+{v.pending_stock})</span>}
                                                        </td>
                                                        <td className="px-2 sm:px-4 py-3 text-right font-medium whitespace-nowrap">
                                                            {editingRetailPriceId === v.id ? (
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <div className="flex items-center bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 w-32 shadow-sm transition-all focus-within:border-black dark:focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-black dark:focus-within:ring-zinc-500">
                                                                        <span className="text-zinc-400 select-none text-[10px] font-bold tracking-widest mr-1">MMK</span>
                                                                        <FormattedNumberInput
                                                                            autoFocus
                                                                            value={editRetailPriceValue}
                                                                            onChange={(val) => setEditRetailPriceValue(val)}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') handleSaveRetailPrice(v.id);
                                                                                if (e.key === 'Escape') setEditingRetailPriceId(null);
                                                                            }}
                                                                            placeholder="Price"
                                                                            className="w-full h-7 p-0 text-xs font-bold border-none bg-transparent focus-visible:ring-0 text-right shadow-none text-black dark:text-white"
                                                                        />
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSaveRetailPrice(v.id)}
                                                                        disabled={isSavingRetailPrice}
                                                                        className="h-8 px-2.5 bg-black hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-200 text-white dark:text-black rounded-lg flex items-center justify-center shrink-0 transition-colors shadow-sm disabled:opacity-50"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditingRetailPriceId(null)}
                                                                        className="h-8 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-500 dark:text-zinc-400 rounded-lg flex items-center justify-center shrink-0 transition-colors shadow-sm"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center justify-end gap-1.5 sm:gap-2 group">
                                                                    <span className="font-bold">{formatMMK(v.retail_price || product.retail_price)} <span className="text-[10px] text-zinc-400">MMK</span></span>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditingRetailPriceId(v.id);
                                                                            setEditRetailPriceValue((v.retail_price || product.retail_price).toString());
                                                                        }}
                                                                        className="h-7 w-7 rounded-lg bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-black dark:hover:text-white transition-all border border-zinc-200 dark:border-zinc-800"
                                                                        title="Edit Price"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <td className="px-4 py-3 text-right">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                            className="text-[10px] font-bold uppercase tracking-widest"
                                                            onClick={() => handleRestoreVariant(v.id)}
                                                        >
                                                            Restore
                                                        </Button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>


                        <div className="flex gap-4 mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                            <button
                                onClick={() => setActiveTab('activity')}
                                className={twMerge("text-xs font-bold uppercase tracking-widest pb-2 border-b-2 transition-colors", activeTab === 'activity' ? "text-black dark:text-white border-black dark:border-white" : "text-zinc-400 border-transparent hover:text-zinc-600")}
                            >
                                Activity History
                            </button>
                            <button
                                onClick={() => setActiveTab('batches')}
                                className={twMerge("text-xs font-bold uppercase tracking-widest pb-2 border-b-2 transition-colors", activeTab === 'batches' ? "text-black dark:text-white border-black dark:border-white" : "text-zinc-400 border-transparent hover:text-zinc-600")}
                            >
                                Batches & Costs
                            </button>
                        </div>

                        {activeTab === 'activity' && (
                            !product.variants || product.variants.flatMap(v => v.inventory_logs || []).length === 0 ? (
                                <EmptyState
                                    title="No Activity Recorded"
                                    description="There is no recorded activity for this product yet."
                                />
                            ) : (
                                <div className="flex flex-col gap-6 relative">
                                    <div className="absolute left-2.5 top-2 bottom-2 w-px bg-zinc-100 dark:bg-zinc-800" />

                                        {product.variants.flatMap(v => v.inventory_logs?.map(log => ({ ...log, variant: v })) || []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map((log: any) => {
                                        const isPositive = log.quantity_change > 0;
                                        return (
                                            <div key={log.id} className="flex justify-between items-start relative pl-8">
                                                <div className={twMerge("absolute left-1 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-black", isPositive ? "bg-green-500" : "bg-black dark:bg-zinc-400")} />

                                                <div className="flex-1">
                                                    <h4 className="text-sm font-bold text-black dark:text-white uppercase">{formatReason(log.reason)}</h4>
                                                    <span className="text-[10px] text-zinc-400 font-medium tracking-wider block mt-1">
                                                        {new Date(log.created_at).toLocaleString()} • {Object.values(log.variant.attributes || {}).join(' / ') || 'Default Variant'}
                                                    </span>
                                                    {log.note && (
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic mt-2 bg-zinc-50 dark:bg-zinc-900 p-2 rounded-lg inline-block">
                                                            "{log.note}"
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex flex-col items-end text-right ml-4">
                                                    <span className={twMerge("text-lg font-black", isPositive ? "text-green-600 dark:text-green-500" : "text-red-500")}>
                                                        {isPositive ? "+" : ""}{log.quantity_change}
                                                    </span>
                                                    <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                                                        Stock: {log.new_stock_level}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )
                        )}

                        {activeTab === 'batches' && (
                            <div className="flex flex-col gap-4">
                                {(() => {
                                    const allBatches = product.variants?.flatMap(v => v.batches?.map(b => ({ ...b, variant: v })) || []) || [];
                                    const totalBatchRemaining = allBatches.reduce((acc, b) => acc + b.remaining_quantity, 0) || 0;
                                    const stockDesync = stock - totalBatchRemaining;

                                    return (
                                        <>
                                            {stockDesync > 0 && (
                                                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl mb-2">
                                                    <span className="text-sm font-bold text-orange-800 dark:text-orange-400 block mb-1">Stock Mismatch Detected</span>
                                                    <span className="text-xs text-orange-700 dark:text-orange-300">
                                                        There are {stockDesync} items in stock that are not linked to any specific batch (likely due to manual stock adjustments). They will use the default product cost/price.
                                                    </span>
                                                </div>
                                            )}

                                            {allBatches.length > 0 ? (
                                                allBatches.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(batch => (
                                                    <div key={batch.id} className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                                                        <div>
                                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                                                                Batch #{batch.id} • {new Date(batch.created_at).toLocaleDateString()} • {Object.values(batch.variant.attributes || {}).join(' / ') || 'Default'}
                                                            </span>
                                                            <span className="text-sm font-black text-black dark:text-white block">
                                                                {formatMMK(batch.unit_cost)} MMK <span className="text-xs text-zinc-400 font-medium">cost / unit</span>
                                                            </span>
                                                            {batch.retail_price !== null && batch.retail_price !== undefined ? (
                                                                <span className="text-xs font-bold text-zinc-500 block mt-0.5">
                                                                    Retail: {formatMMK(batch.retail_price)} MMK
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs font-bold text-zinc-400 block mt-0.5">
                                                                    Retail: {formatMMK(product.retail_price || 0)} MMK <span className="italic font-normal">(Default)</span>
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-right flex flex-col items-end">
                                                            <span className={twMerge("text-[10px] font-bold uppercase tracking-widest mb-1", batch.remaining_quantity > 0 ? "text-green-600 dark:text-green-500" : "text-zinc-500")}>
                                                                {batch.remaining_quantity > 0 ? "Active" : "Depleted"}
                                                            </span>
                                                            <span className="text-sm font-black text-zinc-800 dark:text-zinc-200">
                                                                {batch.remaining_quantity} / {batch.initial_quantity} left
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                    <EmptyState
                                                        title="No Batches Recorded"
                                                        description="There are no inventory batches recorded for this product yet."
                                                />
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Archive Confirm Dialog */}
            <Dialog open={isArchiveDialogOpen} onOpenChange={setIsArchiveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{product.is_active ? 'Archive Product?' : 'Restore Product?'}</DialogTitle>
                        <DialogDescription>
                            {product.is_active
                                ? `Are you sure you want to archive ${product.name}? It will be hidden from new orders and lists by default, but its historical data will be preserved.`
                                : `Are you sure you want to restore ${product.name}? It will become available for new orders again.`
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 mt-4">
                        <Button
                            onClick={handleToggleActive}
                            className={twMerge("text-white font-bold h-12", product.is_active ? "bg-orange-500 hover:bg-orange-600" : "bg-green-600 hover:bg-green-700")}
                        >
                            {product.is_active ? 'YES, ARCHIVE' : 'YES, RESTORE'}
                        </Button>
                        <Button variant="outline" onClick={() => setIsArchiveDialogOpen(false)} className="h-12 font-bold">
                            CANCEL
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
