import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

import { PaginatedData } from '@/types/pagination';
import Pagination from '@/components/Pagination';

interface Category {
    id: number;
    name: string;
}

export default function Categories({ categories }: { categories: PaginatedData<Category> }) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<Category | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: ''
    });

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
                onSuccess: () => {
                    setEditItem(null);
                    reset();
                }
            });
        } else {
            post('/management/categories', {
                onSuccess: () => {
                    setIsAddOpen(false);
                    reset();
                }
            });
        }
    };

    const handleDelete = () => {
        if (deleteId) {
            router.delete(`/management/categories/${deleteId}`, {
                onSuccess: () => setDeleteId(null)
            });
        }
    };

    return (
        <AppLayout title="Categories">
            <Head title="Manage Categories" />

            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div className="flex flex-col gap-6 w-full overflow-x-auto no-scrollbar">
                        <h1 className="text-3xl font-black text-black dark:text-white tracking-tight shrink-0">Management.</h1>
                        <div className="flex gap-4 sm:gap-6 -mb-[17px] min-w-max">
                            <Link href="/management/suppliers" className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white pb-4 transition-colors">Suppliers</Link>
                            <Link href="/management/couriers" className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white pb-4 transition-colors">Couriers</Link>
                            <Link href="/management/categories" className="text-xs font-bold uppercase tracking-widest text-black dark:text-white border-b-2 border-black dark:border-white pb-4">Categories</Link>
                        </div>
                    </div>
                    <Button onClick={openAdd} className="uppercase tracking-widest text-[10px] font-bold px-4 py-2 h-9 mb-1 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                        + New Category
                    </Button>
                </div>

                <div className="flex flex-col">
                    {categories.data.length === 0 ? (
                        <div className="mt-10 flex justify-center items-center p-10 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50">
                            <span className="text-zinc-400 font-medium">No categories found.</span>
                        </div>
                    ) : (
                        categories.data.map((item) => (
                            <div key={item.id} className="py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center px-4 -mx-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                <div>
                                    <span className="text-base font-bold text-black dark:text-white block">{item.name}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => openEdit(item)} className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">EDIT</button>
                                    <button onClick={() => setDeleteId(item.id)} className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">DELETE</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <Pagination meta={categories} />
            </div>

            <Dialog open={isAddOpen || !!editItem} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setEditItem(null); reset(); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Edit Category' : 'New Category'}</DialogTitle>
                        <DialogDescription>{editItem ? 'Update product category details.' : 'Create a new product category.'}</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label>Category Name</Label>
                                <Input value={data.name} onChange={e => setData('name', e.target.value)} required placeholder="e.g. T-Shirts" autoFocus />
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
