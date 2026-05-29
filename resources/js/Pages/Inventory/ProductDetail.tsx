import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router } from '@inertiajs/react';
import { Product, InventoryLog } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { twMerge } from 'tailwind-merge';

export default function ProductDetail({ product, latestCost, latestRetailPrice, pendingCost }: { product: Product, latestCost: number, latestRetailPrice: number, pendingCost: number }) {
    const [activeTab, setActiveTab] = useState<'activity' | 'batches'>('activity');
    
    const stock = product.stock_quantity ?? 0;

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

    const formatMMK = (val: number) => Number(val).toLocaleString();

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
                    <button onClick={() => router.visit(`/inventory/${product.id}/edit`)} className="text-xs font-bold text-zinc-400 hover:text-black dark:hover:text-white uppercase tracking-widest transition-colors">
                        EDIT
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        {/* HERO */}
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 items-center flex flex-col text-center">
                            <div className="w-24 h-24 bg-white dark:bg-black rounded-2xl mb-4 items-center justify-center shadow-sm flex">
                                <span className="text-4xl">📦</span>
                            </div>
                            <h2 className="text-2xl font-black text-black dark:text-white mb-1">{product.name}</h2>
                            <span className="text-sm text-zinc-400 font-bold uppercase tracking-widest">{product.sku || "NO SKU"}</span>
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
                                <span className="text-3xl lg:text-4xl font-black text-zinc-400">{product.pending_stock || 0}</span>
                                {pendingCost > 0 && (
                                    <span className="text-[10px] font-bold text-zinc-500 mt-1">Est. {formatMMK(pendingCost)} MMK/ea</span>
                                )}
                            </div>
                        </div>

                        {/* FINANCIALS */}
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                            <div className="flex justify-between mb-4">
                                <span className="text-sm font-medium text-zinc-500">Retail Price <span className="text-[10px] text-zinc-400">(Latest)</span></span>
                                <span className="text-sm font-bold text-black dark:text-white">{formatMMK(latestRetailPrice || 0)} MMK</span>
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
                    <div className="lg:col-span-2">
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
                            !product.inventory_logs || product.inventory_logs.length === 0 ? (
                                <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                                    <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">No activity recorded</span>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-6 relative">
                                    <div className="absolute left-2.5 top-2 bottom-2 w-px bg-zinc-100 dark:bg-zinc-800" />
                                    
                                    {product.inventory_logs.map((log: InventoryLog) => {
                                        const isPositive = log.quantity_change > 0;
                                        return (
                                            <div key={log.id} className="flex justify-between items-start relative pl-8">
                                                <div className={twMerge("absolute left-1 top-1.5 w-3 h-3 rounded-full border-2 border-white dark:border-black", isPositive ? "bg-green-500" : "bg-black dark:bg-zinc-400")} />
                                                
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-bold text-black dark:text-white uppercase">{formatReason(log.reason)}</h4>
                                                    <span className="text-[10px] text-zinc-400 font-medium tracking-wider block mt-1">
                                                        {new Date(log.created_at).toLocaleString()}
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
                                    const totalBatchRemaining = product.batches?.reduce((acc, b) => acc + b.remaining_quantity, 0) || 0;
                                    const stockDesync = product.stock_quantity - totalBatchRemaining;
                                    
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

                                            {product.batches && product.batches.length > 0 ? (
                                                product.batches.map(batch => (
                                                    <div key={batch.id} className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                                                        <div>
                                                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                                                                Batch #{batch.id} • {new Date(batch.created_at).toLocaleDateString()}
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
                                                <div className="p-8 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
                                                    <span className="text-zinc-400 text-xs font-bold uppercase tracking-wider">No batches recorded</span>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </AppLayout>
    );
}
