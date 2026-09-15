import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import StorefrontLayout from '@/Layouts/StorefrontLayout';
import { motion } from 'motion/react';
import { ShoppingBag, Search, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface CategoryItem {
    id: number;
    name: string;
}

interface ProductsProps {
    shop: { name: string; slug: string; settings?: any };
    categories: CategoryItem[];
    products: {
        data: any[];
        links: any[];
        current_page: number;
        last_page: number;
        total: number;
    };
    filters: {
        category?: string;
        search?: string;
        sort?: string;
    };
}

export default function Products({ shop, categories, products, filters }: ProductsProps) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');

    const handleCategoryClick = (categoryId?: number) => {
        router.get(`/${shop.slug}/products`, {
            ...filters,
            category: categoryId ? categoryId.toString() : undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(`/${shop.slug}/products`, {
            ...filters,
            search: searchTerm || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleSortChange = (sortValue: string) => {
        router.get(`/${shop.slug}/products`, {
            ...filters,
            sort: sortValue || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <StorefrontLayout shop={shop}>
            <Head title={`${shop.name} | All Products`} />

            <div className="pt-28 sm:pt-36 pb-24 px-4 sm:px-6 md:px-12 max-w-7xl mx-auto w-full">
                
                {/* Header Title */}
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 sm:mb-8"
                >
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-2">All Products</h1>
                    <p className="text-sm sm:text-base text-zinc-500">
                        {products.total} {products.total === 1 ? 'item' : 'items'} available
                    </p>
                </motion.div>

                {/* Filter & Search Toolbar */}
                <div className="flex flex-col gap-4 mb-8">
                    
                    {/* Search & Sort Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search products..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all shadow-xs"
                            />
                        </form>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <select
                                value={filters.sort || 'latest'}
                                onChange={(e) => handleSortChange(e.target.value)}
                                className="px-4 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white shadow-xs cursor-pointer"
                            >
                                <option value="latest">Newest First</option>
                                <option value="price_asc">Price: Low to High</option>
                                <option value="price_desc">Price: High to Low</option>
                            </select>
                        </div>
                    </div>

                    {/* Horizontal Scrolling Category Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                        <button
                            type="button"
                            onClick={() => handleCategoryClick(undefined)}
                            style={!filters.category ? { backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' } : { backgroundColor: 'var(--store-card)', color: 'var(--store-text)' }}
                            className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95 shadow-xs shrink-0 border border-white/10"
                        >
                            All ({products.total})
                        </button>

                        {categories.map((cat) => {
                            const isSelected = filters.category === cat.id.toString();
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => handleCategoryClick(cat.id)}
                                    style={isSelected ? { backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' } : { backgroundColor: 'var(--store-card)', color: 'var(--store-text)' }}
                                    className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all active:scale-95 shadow-xs shrink-0 border border-white/10 opacity-90 hover:opacity-100"
                                >
                                    {cat.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Product Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                    {products.data.map((product: any, i: number) => {
                        const img = product.image_url || product.media?.[0]?.original_url;
                        const price = product.variants?.[0]?.retail_price || product.retail_price || 0;

                        return (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, delay: i * 0.04 }}
                                className="group flex flex-col"
                            >
                                <Link 
                                    href={`/${shop.slug}/products`}
                                    style={{ backgroundColor: 'var(--store-card)' }}
                                    className="relative aspect-[4/5] rounded-2xl overflow-hidden mb-3 border border-white/10 flex items-center justify-center shadow-md"
                                >
                                    {img ? (
                                        <img 
                                            src={img} 
                                            alt={product.name}
                                            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center opacity-40 text-white">
                                            <ShoppingBag className="w-10 h-10" />
                                        </div>
                                    )}

                                    {product.category && (
                                        <span className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            {product.category.name}
                                        </span>
                                    )}
                                </Link>
                                
                                <div className="flex flex-col gap-1">
                                    <Link href={`/${shop.slug}/products`} className="font-bold text-sm sm:text-base hover:underline truncate text-[var(--store-text)]">
                                        {product.name}
                                    </Link>
                                    <span className="text-xs sm:text-sm font-bold opacity-75 text-[var(--store-text)]">
                                        {Number(price).toLocaleString()} MMK
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}

                    {products.data.length === 0 && (
                        <div className="col-span-full py-24 text-center text-zinc-500 border border-dashed border-zinc-300 dark:border-zinc-800 rounded-2xl">
                            <ShoppingBag className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700 mb-3" />
                            <p className="font-bold text-base">No products found</p>
                            <p className="text-xs text-zinc-400 mt-1">Try selecting a different category or clearing search filters.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {products.last_page > 1 && (
                    <div className="flex justify-center gap-2 mt-12">
                        {products.links.map((link: any, idx: number) => {
                            if (!link.url) {
                                return (
                                    <span
                                        key={idx}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                        className="px-3.5 py-2 rounded-lg text-xs text-zinc-400 border border-zinc-200 dark:border-zinc-800 opacity-50"
                                    />
                                );
                            }
                            return (
                                <Link
                                    key={idx}
                                    href={link.url}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                    className={twMerge(
                                        "px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors",
                                        link.active
                                            ? "bg-black text-white dark:bg-white dark:text-black border-transparent"
                                            : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                    )}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </StorefrontLayout>
    );
}
