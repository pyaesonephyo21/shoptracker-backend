import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { twMerge } from 'tailwind-merge';
import { Product } from '../../types/inventory';

export default function InventoryList({ products = [] }: { products: Product[] }) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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

                <div className="bg-zinc-50 dark:bg-zinc-900 border-2 border-transparent focus-within:border-black focus-within:bg-white dark:focus-within:border-white dark:focus-within:bg-black rounded-xl px-4 h-14 flex items-center transition-all duration-200 focus-within:ring-4 focus-within:ring-black/5 dark:focus-within:ring-white/10">
                    <input
                        className="flex-1 bg-transparent text-sm font-medium text-black dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                        placeholder="Search by name or SKU..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
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
                    {filteredProducts.length === 0 ? (
                        <div className="mt-10 flex justify-center items-center">
                            <span className="text-zinc-400 font-medium">No products found.</span>
                        </div>
                    ) : (
                        filteredProducts.map((item) => {
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
                                </Link>
                            );
                        })
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
