import React, { useState, useEffect } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { twMerge } from 'tailwind-merge';
import { Product } from '../../types/inventory';
import { PaginatedData } from '../../types/pagination';
import Pagination from '@/components/Pagination';

import { router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function InventoryList({ products, filters = { search: '', type: '', filter: '' } }: { products: PaginatedData<Product>, filters: { search: string, type: string, filter: string } }) {
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [activeType, setActiveType] = useState(filters.type || '');
    const [activeFilter, setActiveFilter] = useState(filters.filter || '');
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            // Only trigger if local search differs from current URL search
            if (searchQuery !== (filters.search || '')) {
                handleFilterChange(searchQuery, activeType, activeFilter);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]); // Only trigger on searchQuery change

    const handleFilterChange = (search: string, type: string, filter: string) => {
        router.get('/inventory', {
            search: search || undefined,
            type: type || undefined,
            filter: filter || undefined
        }, { preserveState: true, replace: true });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilterChange(searchQuery, activeType, activeFilter);
    };

    const handleDelete = () => {
        if (!productToDelete) return;
        router.delete(`/inventory/${productToDelete.id}`, {
            onSuccess: () => setProductToDelete(null)
        });
    };

	const getStockStatus = (qty: number) => {
		if (qty <= 0) return { color: "text-red-500", label: "Out of Stock" };
		if (qty <= 5) return { color: "text-orange-500", label: "Low Stock" };
		return { color: "text-green-600 dark:text-green-500", label: "In Stock" };
	};

    return (
        <AppLayout title="Inventory">
            <Head title="Inventory" />

			<div className="flex flex-col gap-6">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                        Inventory.
                    </h1>
                </div>

                <form onSubmit={handleSearchSubmit} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 h-11 flex items-center transition-all duration-200 focus-within:bg-white dark:focus-within:bg-black focus-within:border-black dark:focus-within:border-white">
                    <input
                        className="flex-1 bg-transparent text-sm font-medium text-black dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                        placeholder="Search by name or SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button type="submit" className="text-xs font-bold uppercase text-zinc-400 hover:text-black dark:hover:text-white">Search</button>
                </form>

                {/* COMPACT FILTERS */}
                <div className="flex flex-col gap-2">
                    {/* Product Type Filter */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider select-none shrink-0">Type:</span>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1 scrollbar-none">
                            {[
                                { key: '', label: 'All' },
                                { key: 'local', label: 'Local' },
                                { key: 'global', label: 'Global' }
                            ].map(item => {
                                const active = activeType === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => {
                                            const nextType = activeType === item.key ? '' : item.key;
                                            setActiveType(nextType);
                                            handleFilterChange(searchQuery, nextType, activeFilter);
                                        }}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all select-none whitespace-nowrap ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Stock Alert Filter */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider select-none shrink-0">Stock:</span>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1 scrollbar-none">
                            {[
                                { key: '', label: 'All' },
                                { key: 'low_stock', label: 'Low Stock' }
                            ].map(item => {
                                const active = activeFilter === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        onClick={() => {
                                            const nextFilter = activeFilter === item.key ? '' : item.key;
                                            setActiveFilter(nextFilter);
                                            handleFilterChange(searchQuery, activeType, nextFilter);
                                        }}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all select-none whitespace-nowrap ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                    >
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Link
                        href="/inventory/create"
                        className="flex-1 bg-black py-4 rounded-xl items-center justify-center transition-transform duration-200 active:scale-[0.98] dark:bg-white shadow-sm flex"
                    >
                        <span className="text-[10px] font-bold text-white dark:text-black uppercase tracking-widest">
                            + New Product
                        </span>
                    </Link>

                    <Link
                        href="/inventory/purchase-orders"
                        className="flex-1 bg-zinc-100 dark:bg-zinc-900 py-4 rounded-xl items-center justify-center border border-zinc-200 dark:border-zinc-800 transition-transform duration-200 active:scale-[0.98] flex hover:bg-zinc-200 dark:hover:bg-zinc-800"
                    >
                        <span className="text-[10px] font-bold text-black dark:text-white uppercase tracking-widest">
                            View Purchases
                        </span>
                    </Link>
                </div>

                <div className="flex flex-col">
                    {products.data.length === 0 ? (
                        <div className="mt-10 flex justify-center items-center">
                            <span className="text-zinc-400 font-medium">No products found.</span>
                        </div>
                    ) : (
                            products.data.map((item) => {
                            const stock = item.stock_quantity ?? 0;
                            const status = getStockStatus(stock);

                            return (
                                <Link
                                    key={item.id}
                                    href={`/inventory/${item.id}`}
                                    className="py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 -mx-4 px-4 rounded-xl group"
                                >
                                    <div className="flex-1 mr-4 overflow-hidden">
                                        <p className="font-bold text-black dark:text-white text-base truncate">
                                            {item.name}
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            {item.sku || "No SKU"} • {item.category?.name || "Uncategorized"}
                                        </p>
                                    </div>

                                    <div className="flex flex-col items-end min-w-[70px]">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col items-end">
                                                <span className={twMerge("font-black text-lg leading-tight", stock === 0 ? "text-zinc-300 dark:text-zinc-700" : "text-black dark:text-white")}>
                                                    {stock}
                                                </span>
                                                <span className={twMerge("text-[8px] uppercase font-bold tracking-wider mb-1", status.color)}>
                                                    {status.label}
                                                </span>

                                                {item.pending_stock > 0 && (
                                                    <div className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded mt-1">
                                                        <span className="text-[9px] font-bold text-green-700 dark:text-green-400">
                                                            +{item.pending_stock} Arriving
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    setProductToDelete(item);
                                                }}
                                                className="p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                            </button>
                                        </div>


                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
                
                <Pagination meta={products} />
            </div>

            <Dialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Product?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{productToDelete?.name}</strong>? This action cannot be undone. You can only delete products that have no associated orders or history.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 mt-4">
                        <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold h-12">
                            YES, DELETE
                        </Button>
                        <Button variant="outline" onClick={() => setProductToDelete(null)} className="h-12 font-bold">
                            CANCEL
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
