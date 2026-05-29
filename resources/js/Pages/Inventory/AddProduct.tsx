import React from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Category } from '@/types/inventory';

export default function AddProduct({ categories = [] }: { categories: Category[] }) {
    const { data, setData, post, processing, errors } = useForm<{
        name: string;
        sku: string;
        category_id: string;
        type: string;
    }>({
        name: '',
        sku: '',
        category_id: '',
        type: 'local',
    });

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

        post('/inventory', {
            onError: (err) => {
                if (Object.keys(err).length === 0) {
                    alert('Failed to create product');
                }
            }
        });
    };

    return (
        <AppLayout title="Add Product">
            <Head title="New Product" />

            <div className="flex flex-col max-w-2xl mx-auto w-full">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                        New Product.
                    </h1>
                    <button
                        type="button"
                        onClick={() => router.visit('/inventory')}
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



                    <div className="mt-4 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                        <Button
                            type="submit"
                            disabled={processing}
                            className="w-full h-12 text-sm font-bold tracking-wide"
                        >
                            {processing ? "CREATING..." : "CREATE PRODUCT"}
                        </Button>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
