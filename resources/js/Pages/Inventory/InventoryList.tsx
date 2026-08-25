import React, { useState, useEffect } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { twMerge } from 'tailwind-merge';
import { Product } from '../../types/inventory';
import { PaginatedData } from '../../types/pagination';
import Pagination from '@/components/Pagination';

import { router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { useRevalidateOnBack } from '@/hooks/useRevalidateOnBack';

interface CategoryItem {
    id: number;
    name: string;
}

interface InventoryFilters {
    search: string;
    type: string;
    filter: string;
    category_id?: string;
    status?: string;
}

export default function InventoryList({ 
    products, 
    categories = [],
    filters = { search: '', type: '', filter: '', category_id: '', status: 'active' } 
}: { 
    products: PaginatedData<Product>, 
    categories?: CategoryItem[],
    filters: InventoryFilters 
}) {
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [activeType, setActiveType] = useState(filters.type || '');
    const [activeFilter, setActiveFilter] = useState(filters.filter || '');
    const [activeCategory, setActiveCategory] = useState(filters.category_id || '');
    const [activeStatus, setActiveStatus] = useState(filters.status || 'active');
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);

    const hasActiveFilters = Boolean(
        filters.type ||
        filters.filter ||
        filters.category_id ||
        (filters.status && filters.status !== 'active')
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            // Only trigger if local search differs from current URL search
            if (searchQuery !== (filters.search || '')) {
                handleFilterChange(searchQuery, activeType, activeFilter, activeStatus, activeCategory);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]); // Only trigger on searchQuery change

    useRevalidateOnBack(['products']);

    const handleFilterChange = (search: string, type: string, filter: string, status: string, categoryId: string = activeCategory) => {
        router.get('/inventory', {
            search: search || undefined,
            type: type || undefined,
            filter: filter || undefined,
            category_id: categoryId || undefined,
            status: status || undefined,
            page: 1
        }, { preserveState: true, replace: true });
    };

    const handleCategoryClick = (catId: string) => {
        const nextCategory = activeCategory === catId ? '' : catId;
        setActiveCategory(nextCategory);
        handleFilterChange(searchQuery, activeType, activeFilter, activeStatus, nextCategory);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilterChange(searchQuery, activeType, activeFilter, activeStatus, activeCategory);
    };

    const applyFilters = () => {
        handleFilterChange(searchQuery, activeType, activeFilter, activeStatus, activeCategory);
        setIsFilterOpen(false);
    };

    const clearFilters = () => {
        setActiveType('');
        setActiveFilter('');
        setActiveCategory('');
        setActiveStatus('active');
        handleFilterChange(searchQuery, '', '', 'active', '');
        setIsFilterOpen(false);
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
                <div className="flex justify-between items-end border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                        Inventory
                    </h1>
                    <Link href="/inventory/adjustments">
                        <Button variant="outline" className="h-9 px-4">
                            Adjustments Ledger
                        </Button>
                    </Link>
                </div>

                <div className="flex items-center gap-2">
                    <form onSubmit={handleSearchSubmit} className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 h-11 flex items-center transition-all duration-200 focus-within:bg-white dark:focus-within:bg-black focus-within:border-black dark:focus-within:border-white">
                        <input
                            className="flex-1 bg-transparent text-sm font-medium text-black dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                            placeholder="Search by name or SKU..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="submit" className="text-xs font-bold uppercase text-zinc-400 hover:text-black dark:hover:text-white">Search</button>
                    </form>

                    <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <DialogTrigger className={`h-11 px-4 flex items-center justify-center gap-2 rounded-xl transition-colors shrink-0 relative ${hasActiveFilters ? 'bg-black dark:bg-white' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
                            <Filter className={`w-4 h-4 ${hasActiveFilters ? 'text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-300'}`} />
                            <span className={`text-xs font-bold uppercase tracking-widest hidden sm:block ${hasActiveFilters ? 'text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-300'}`}>Filters</span>
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 shadow-sm ring-2 ring-white dark:ring-black" />
                            )}
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle className="font-black text-xl uppercase tracking-widest">Filters</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col gap-6 py-4">
                                {/* Product Type Filter */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Type</span>
                                    <div className="flex flex-wrap items-center gap-2">
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
                                                    }}
                                                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all select-none whitespace-nowrap ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Stock Alert Filter */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Stock</span>
                                    <div className="flex flex-wrap items-center gap-2">
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
                                                    }}
                                                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all select-none whitespace-nowrap ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Category Filter */}
                                {categories.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Category</span>
                                        <div className="flex flex-wrap items-center gap-2 max-h-36 overflow-y-auto no-scrollbar">
                                            <button
                                                key="cat-all"
                                                onClick={() => setActiveCategory('')}
                                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all select-none whitespace-nowrap ${!activeCategory ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                            >
                                                All
                                            </button>
                                            {categories.map(cat => {
                                                const active = activeCategory === String(cat.id);
                                                return (
                                                    <button
                                                        key={cat.id}
                                                        onClick={() => {
                                                            const nextCat = activeCategory === String(cat.id) ? '' : String(cat.id);
                                                            setActiveCategory(nextCat);
                                                        }}
                                                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all select-none whitespace-nowrap ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                                    >
                                                        {cat.name}
                                                    </button>
                                                );
                                            })}
                                            <button
                                                key="cat-uncategorized"
                                                onClick={() => {
                                                    const nextCat = activeCategory === 'uncategorized' ? '' : 'uncategorized';
                                                    setActiveCategory(nextCat);
                                                }}
                                                className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all select-none whitespace-nowrap ${activeCategory === 'uncategorized' ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                            >
                                                Uncategorized
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Status Filter */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Status</span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {[
                                            { key: 'active', label: 'Active' },
                                            { key: 'archived', label: 'Archived' },
                                            { key: '', label: 'All' }
                                        ].map(item => {
                                            const active = activeStatus === item.key;
                                            return (
                                                <button
                                                    key={item.key}
                                                    onClick={() => {
                                                        const nextStatus = activeStatus === item.key ? 'active' : item.key;
                                                        setActiveStatus(nextStatus);
                                                    }}
                                                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all select-none whitespace-nowrap ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                <Button variant="outline" onClick={clearFilters} className="font-bold uppercase tracking-widest text-[10px]">Clear</Button>
                                <Button onClick={applyFilters} className="font-bold uppercase tracking-widest text-[10px]">Apply Filters</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Ultra-Compact Category Pill Bar */}
                {categories.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-4 px-4 sm:mx-0 sm:px-0">
                        <button
                            onClick={() => handleCategoryClick('')}
                            className={twMerge(
                                "h-7 px-3 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all select-none shrink-0 flex items-center justify-center",
                                !activeCategory
                                    ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
                                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400"
                            )}
                        >
                            All
                        </button>
                        {categories.map((cat) => {
                            const active = activeCategory === String(cat.id);
                            return (
                                <button
                                    key={cat.id}
                                    onClick={() => handleCategoryClick(String(cat.id))}
                                    className={twMerge(
                                        "h-7 px-3 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all select-none shrink-0 flex items-center justify-center",
                                        active
                                            ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
                                            : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400"
                                    )}
                                >
                                    {cat.name}
                                </button>
                            );
                        })}
                        <button
                            onClick={() => handleCategoryClick('uncategorized')}
                            className={twMerge(
                                "h-7 px-3 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all select-none shrink-0 flex items-center justify-center",
                                activeCategory === 'uncategorized'
                                    ? "bg-black text-white dark:bg-white dark:text-black shadow-xs"
                                    : "bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400"
                            )}
                        >
                            Uncategorized
                        </button>
                    </div>
                )}

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
                        <EmptyState 
                            title="No Products Found" 
                            description="There are no products matching your search or filters."
                            action={
                                <Button variant="outline" onClick={clearFilters} className="text-xs font-bold uppercase tracking-widest">
                                    Clear Filters
                                </Button>
                            }
                        />
                    ) : (
                            products.data.map((item: any) => {
                            const stock = Number(item.variants_sum_stock_quantity || 0);
                            const pendingStock = Number(item.variants_sum_pending_stock || 0);
                            const status = getStockStatus(stock);

                            return (
                                <Link
                                    key={item.id}
                                    href={`/inventory/${item.id}`}
                                    className={twMerge(
                                        "py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/50 -mx-4 px-4 rounded-xl group",
                                        item.is_active === false && "opacity-60 grayscale hover:opacity-100 bg-zinc-50/50 dark:bg-zinc-900/20"
                                    )}
                                >
                                    <div className="flex-1 mr-4 overflow-hidden">
                                        <p className={twMerge("font-bold text-base truncate flex items-center gap-2", item.is_active === false ? "text-zinc-500 line-through decoration-zinc-300 dark:decoration-zinc-700" : "text-black dark:text-white")}>
                                            {item.name}
                                            {item.is_active === false && (
                                                <span className="text-[9px] bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded uppercase tracking-widest font-black border border-red-200 dark:border-red-900/50 no-underline">Archived</span>
                                            )}
                                        </p>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                                            {item.category?.name || "Uncategorized"}
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

                                                {pendingStock > 0 && (
                                                    <div className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded mt-1">
                                                        <span className="text-[9px] font-bold text-green-700 dark:text-green-400">
                                                            +{pendingStock} Arriving
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
