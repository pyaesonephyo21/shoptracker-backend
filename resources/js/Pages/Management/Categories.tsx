import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';

import { PaginatedData } from '@/types/pagination';
import Pagination from '@/components/Pagination';
import ManagementHeader from '@/components/ManagementHeader';

interface Category {
    id: number;
    name: string;
    products_count?: number;
}

export default function Categories({ 
    categories,
    filters = { search: '' }
}: { 
    categories: PaginatedData<Category>,
    filters?: { search?: string }
}) {
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<Category | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: ''
    });

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/management/categories', {
            search: searchQuery || undefined,
            page: 1
        }, { preserveState: true, replace: true });
    };

    const openAdd = () => {
        reset();
        setIsAddOpen(true);
    };

    const openEdit = (item: Category) => {
        setData({ name: item.name });
        setEditItem(item);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editItem) {
            put(`/management/categories/${editItem.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditItem(null);
                    reset();
                    clearErrors();
                }
            });
        } else {
            post('/management/categories', {
                preserveScroll: true,
                onSuccess: () => {
                    setIsAddOpen(false);
                    reset();
                    clearErrors();
                }
            });
        }
    };

    const handleDelete = () => {
        if (deleteId) {
            router.delete(`/management/categories/${deleteId}`, {
                preserveScroll: true,
                onSuccess: () => setDeleteId(null)
            });
        }
    };

    return (
        <AppLayout title="Categories">
            <Head title="Manage Categories" />

            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20">
                <ManagementHeader>
                    <Button onClick={openAdd} className="uppercase tracking-widest text-[10px] font-bold px-4 py-2 h-9">
                        + New Category
                    </Button>
                </ManagementHeader>

                {/* Search Bar */}
                <form onSubmit={handleSearchSubmit} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 h-10 flex items-center transition-all duration-200 focus-within:bg-white dark:focus-within:bg-black focus-within:border-black dark:focus-within:border-white">
                    <input
                        className="flex-1 bg-transparent text-sm font-medium text-black dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                        placeholder="Search categories..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button 
                            type="button" 
                            onClick={() => {
                                setSearchQuery('');
                                router.get('/management/categories', {}, { preserveState: true, replace: true });
                            }} 
                            className="text-xs text-zinc-400 hover:text-black dark:hover:text-white mr-2"
                        >
                            ✕
                        </button>
                    )}
                    <button type="submit" className="text-xs font-bold uppercase text-zinc-400 hover:text-black dark:hover:text-white">Search</button>
                </form>

                <div className="flex flex-col">
                    {categories.data.length === 0 ? (
                        <EmptyState 
                            title="No Categories Found" 
                            description={searchQuery ? "No categories match your search criteria." : "You haven't added any categories yet."} 
                            action={searchQuery ? (
                                <Button 
                                    variant="outline" 
                                    onClick={() => {
                                        setSearchQuery('');
                                        router.get('/management/categories', {}, { preserveState: true, replace: true });
                                    }}
                                    className="text-xs font-bold uppercase tracking-widest"
                                >
                                    Clear Search
                                </Button>
                            ) : undefined}
                        />
                    ) : (
                        categories.data.map((item) => (
                            <div key={item.id} className="py-3.5 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center px-4 -mx-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-base font-bold text-black dark:text-white block">{item.name}</span>
                                    <Link 
                                        href={`/inventory?category_id=${item.id}`}
                                        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors group"
                                    >
                                        <span className="font-semibold text-zinc-600 dark:text-zinc-300 group-hover:underline">
                                            {item.products_count ?? 0} {item.products_count === 1 ? 'Product' : 'Products'}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">→ View in Inventory</span>
                                    </Link>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEdit(item)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-2.5 py-1.5 rounded-lg hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white transition-colors">EDIT</button>
                                    <button onClick={() => setDeleteId(item.id)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-2.5 py-1.5 rounded-lg hover:border-red-200 dark:hover:border-red-900/50 hover:text-red-600 dark:hover:text-red-500 transition-colors">DELETE</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <Pagination meta={categories} />
            </div>

            <Dialog open={isAddOpen || !!editItem} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setEditItem(null); reset(); clearErrors(); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Edit Category' : 'New Category'}</DialogTitle>
                        <DialogDescription>{editItem ? 'Update product category details.' : 'Create a new product category.'}</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label>Category Name</Label>
                                <Input value={data.name} onChange={e => { setData('name', e.target.value); clearErrors('name'); }} placeholder="e.g. T-Shirts" autoFocus />
                                {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                            </div>
                        </div>

                        <Button type="submit" disabled={processing} className="w-full mt-2 font-bold tracking-widest uppercase">
                            {processing ? "Saving..." : (editItem ? "Save Changes" : "Create Category")}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Category?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this category? If there are products linked to it, deletion will fail.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="destructive" onClick={handleDelete} className="w-full">
                            YES, DELETE CATEGORY
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
