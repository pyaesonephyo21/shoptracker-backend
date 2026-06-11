import React from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Category } from '@/types/inventory';
import VariantBuilder, { VariantOption, Variant } from '@/components/VariantBuilder';

export default function AddProduct({ categories = [] }: { categories: Category[] }) {
    const { data, setData, post, processing, errors, clearErrors } = useForm<{
        name: string;
        category_id: string;
        type: string;
        base_cost: number | string;
        retail_price: number | string;
        variant_options: VariantOption[];
        variants: Variant[];
    }>({
        name: '',
        category_id: '',
        type: 'local',
        base_cost: '',
        retail_price: '',
        variant_options: [],
        variants: [],
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
            preserveScroll: true,
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
                                <Label htmlFor="name">Product Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Black Hoodie"
                                    value={data.name}
                                    onChange={(e) => { setData('name', e.target.value); clearErrors('name'); }}
                                />
                                {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Label htmlFor="category">Category</Label>
                                <Select value={data.category_id} onValueChange={(val) => setData('category_id', val ?? '')}>
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
                                <Label htmlFor="type">Product Type</Label>
                                <Select value={data.type} onValueChange={(val) => setData('type', val ?? '')}>
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

                    <section>
                        <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-6">
                            02. Global Pricing
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="base_cost">Base Cost (Optional)</Label>
                                <FormattedNumberInput
                                    id="base_cost"
                                    min="0"
                                    value={data.base_cost}
                                    onChange={(val) => { setData('base_cost', val); clearErrors('base_cost'); }}
                                />
                                {errors.base_cost && <span className="text-red-500 text-xs">{errors.base_cost}</span>}
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="retail_price">Default Retail Price (Optional)</Label>
                                <FormattedNumberInput
                                    id="retail_price"
                                    min="0"
                                    value={data.retail_price}
                                    onChange={(val) => { setData('retail_price', val); clearErrors('retail_price'); }}
                                />
                                {errors.retail_price && <span className="text-red-500 text-xs">{errors.retail_price}</span>}
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-6">
                            03. Variants
                        </h2>
                        <VariantBuilder 
                            options={data.variant_options}
                            setOptions={opts => setData('variant_options', opts)}
                            variants={data.variants}
                            setVariants={vars => setData('variants', vars)}
                        />
                        {errors.variants && <span className="text-red-500 text-xs">{errors.variants}</span>}
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
