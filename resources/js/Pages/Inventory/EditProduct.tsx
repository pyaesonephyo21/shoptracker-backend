import React from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Category, Product } from '@/types/inventory';
import { useState } from 'react';

export default function EditProduct({ product, categories = [] }: { product: Product, categories: Category[] }) {
    const { data, setData, put, processing, errors } = useForm<{
        name: string;
        sku: string;
        category_id: string;
        type: string;
    }>({
        name: product.name || '',
        sku: product.sku || '',
        category_id: product.category_id ? String(product.category_id) : '',
        type: product.type || 'local',
    });

    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const categoryOptions = categories.map((c) => ({
        label: c.name,
        value: String(c.id),
    }));

    const typeOptions = [
        { label: 'Local Stock', value: 'local' },
        { label: 'Global Stock', value: 'global' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        put(`/inventory/${product.id}`, {
            onError: (err) => {
                if (Object.keys(err).length === 0) {
                    alert('Failed to update product');
                }
            }
        });
    };

    const handleDelete = () => {
        router.delete(`/inventory/${product.id}`, {
            onSuccess: () => setShowDeleteModal(false)
        });
    };

    return (
        <AppLayout title="Edit Product">
            <Head title={`Edit ${product.name}`} />

            <div className="flex flex-col max-w-2xl mx-auto w-full">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                        Edit Product.
                    </h1>
                    <button
                        type="button"
                        onClick={() => router.visit(`/inventory/${product.id}`)}
                        className="text-zinc-500 font-bold hover:text-black dark:hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-8 pb-20">
                    <section>
                        <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-6">
                            01. Basics
                        </h2>

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="name">Product Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Black Hoodie"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    required
                                />
                                {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="sku">SKU / Code</Label>
                                <Input
                                    id="sku"
                                    placeholder="Auto-generated if empty"
                                    value={data.sku}
                                    onChange={(e) => setData('sku', e.target.value)}
                                    className="uppercase"
                                />
                                {errors.sku && <span className="text-red-500 text-xs">{errors.sku}</span>}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="category">Category *</Label>
                                <Select value={data.category_id} onValueChange={(val) => setData('category_id', val ?? '')} required>
                                    <SelectTrigger id="category">
                                        <SelectValue placeholder="Select Category...">
                                            {data.category_id ? categoryOptions.find(o => o.value === data.category_id)?.label : null}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categoryOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.category_id && <span className="text-red-500 text-xs">{errors.category_id}</span>}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="type">Product Type *</Label>
                                <Select value={data.type} onValueChange={(val) => setData('type', val ?? '')} required>
                                    <SelectTrigger id="type">
                                        <SelectValue placeholder="Select Type...">
                                            {data.type ? typeOptions.find(o => o.value === data.type)?.label : null}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {typeOptions.map(opt => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.type && <span className="text-red-500 text-xs">{errors.type}</span>}
                            </div>
                        </div>
                    </section>

                    <div className="mt-4 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowDeleteModal(true)}
                            className="w-full sm:w-1/3 h-12 text-sm font-bold tracking-wide border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-900/20"
                        >
                            DELETE PRODUCT
                        </Button>
                        <Button
                            type="submit"
                            disabled={processing}
                            className="w-full sm:w-2/3 h-12 text-sm font-bold tracking-wide"
                        >
                            {processing ? "SAVING..." : "SAVE CHANGES"}
                        </Button>
                    </div>
                </form>
            </div>

            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Product?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{product.name}</strong>? This action cannot be undone. You can only delete products that have no associated orders or history.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 mt-4">
                        <Button onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white font-bold h-12">
                            YES, DELETE
                        </Button>
                        <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="h-12 font-bold">
                            CANCEL
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
