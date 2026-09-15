import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import ManagementHeader from '@/components/ManagementHeader';
import { Store, ExternalLink, Copy, Check } from 'lucide-react';

interface ShopItem {
    id: number;
    name: string;
    slug: string;
    currency_code: string;
    settings?: {
        hero_title?: string;
        hero_subtitle?: string;
        hero_cta_text?: string;
        announcement?: string;
        hero_image_desktop?: string;
        hero_image_mobile?: string;
    };
    users_count?: number;
    products_count?: number;
    created_at: string;
}

export default function Shops({ shops }: { shops: ShopItem[] }) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<ShopItem | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: '',
        slug: '',
        currency_code: 'MMK',
        settings: {
            hero_title: '',
            hero_subtitle: '',
            hero_cta_text: '',
            announcement: '',
            hero_image_desktop: '',
            hero_image_mobile: '',
        },
    });

    const openAdd = () => {
        reset();
        setIsAddOpen(true);
    };

    const openEdit = (item: ShopItem) => {
        setData({
            name: item.name,
            slug: item.slug || '',
            currency_code: item.currency_code || 'MMK',
            settings: {
                hero_title: item.settings?.hero_title || '',
                hero_subtitle: item.settings?.hero_subtitle || '',
                hero_cta_text: item.settings?.hero_cta_text || '',
                announcement: item.settings?.announcement || '',
                hero_image_desktop: item.settings?.hero_image_desktop || '',
                hero_image_mobile: item.settings?.hero_image_mobile || '',
            },
        });
        setEditItem(item);
    };

    const handleCopy = (slug: string) => {
        const url = `${window.location.origin}/${slug}`;
        navigator.clipboard.writeText(url);
        setCopiedSlug(slug);
        setTimeout(() => setCopiedSlug(null), 2000);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editItem) {
            put(`/management/shops/${editItem.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditItem(null);
                    reset();
                    clearErrors();
                },
            });
        } else {
            post('/management/shops', {
                preserveScroll: true,
                onSuccess: () => {
                    setIsAddOpen(false);
                    reset();
                    clearErrors();
                },
            });
        }
    };

    const handleDelete = () => {
        if (deleteId) {
            router.delete(`/management/shops/${deleteId}`, {
                preserveScroll: true,
                onSuccess: () => setDeleteId(null),
            });
        }
    };

    return (
        <AppLayout title="Shops">
            <Head title="Manage Shops" />

            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20">
                <ManagementHeader>
                    <Button onClick={openAdd} className="uppercase tracking-widest text-[10px] font-bold px-4 py-2 h-9">
                        + New Shop
                    </Button>
                </ManagementHeader>

                <div className="flex flex-col">
                    {shops.length === 0 ? (
                        <EmptyState
                            title="No Shops Found"
                            description="You haven't created any shops yet."
                        />
                    ) : (
                        shops.map((item) => (
                            <div
                                key={item.id}
                                className="py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-4 -mx-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-200/60 dark:border-zinc-700">
                                        <Store className="w-5 h-5 text-zinc-600 dark:text-zinc-300" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-base font-bold text-black dark:text-white truncate">{item.name}</span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                                {item.currency_code}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-zinc-400 font-mono">
                                                /{item.slug}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(item.slug)}
                                                className="text-zinc-400 hover:text-black dark:hover:text-white p-1 rounded transition-colors"
                                                title="Copy Storefront URL"
                                            >
                                                {copiedSlug === item.slug ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                            <a
                                                href={`/${item.slug}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline ml-1"
                                            >
                                                <span>View Storefront</span>
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    <span className="text-xs text-zinc-400 mr-2 hidden md:inline">
                                        {item.products_count ?? 0} products · {item.users_count ?? 0} users
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs font-bold"
                                        onClick={() => openEdit(item)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs font-bold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                                        onClick={() => setDeleteId(item.id)}
                                        disabled={shops.length <= 1}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Add / Edit Dialog */}
            <Dialog open={isAddOpen || !!editItem} onOpenChange={(open) => {
                if (!open) {
                    setIsAddOpen(false);
                    setEditItem(null);
                    clearErrors();
                }
            }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Edit Shop' : 'Create New Shop'}</DialogTitle>
                        <DialogDescription>
                            Configure the shop name and public URL slug for customers.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="name">Shop Name</Label>
                            <Input
                                id="name"
                                value={data.name}
                                onChange={(e) => {
                                    setData((prev) => ({
                                        ...prev,
                                        name: e.target.value,
                                        ...(!editItem && !prev.slug ? { slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') } : {}),
                                    }));
                                }}
                                placeholder="e.g. Acme Store"
                                required
                            />
                            {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="slug">
                                Public Storefront Slug
                                <span className="text-xs text-zinc-400 font-normal ml-1">(letters, numbers, dashes)</span>
                            </Label>
                            <div className="flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-3">
                                <span className="text-xs text-zinc-400 font-mono select-none">/</span>
                                <Input
                                    id="slug"
                                    value={data.slug}
                                    onChange={(e) => setData('slug', e.target.value)}
                                    placeholder="acme-store"
                                    className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 font-mono text-xs"
                                />
                            </div>
                            {errors.slug && <span className="text-xs text-red-500">{errors.slug}</span>}
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="currency_code">Currency</Label>
                            <Input
                                id="currency_code"
                                value={data.currency_code}
                                onChange={(e) => setData('currency_code', e.target.value)}
                                placeholder="MMK, USD, THB"
                            />
                            {errors.currency_code && <span className="text-xs text-red-500">{errors.currency_code}</span>}
                        </div>

                        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Storefront Customization</span>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="announcement">Announcement Bar (Optional)</Label>
                                <Input
                                    id="announcement"
                                    value={data.settings.announcement}
                                    onChange={(e) => setData('settings', { ...data.settings, announcement: e.target.value })}
                                    placeholder="e.g. Free shipping on all orders over 50,000 MMK"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="hero_subtitle">Hero Badge / Subtitle</Label>
                                <Input
                                    id="hero_subtitle"
                                    value={data.settings.hero_subtitle}
                                    onChange={(e) => setData('settings', { ...data.settings, hero_subtitle: e.target.value })}
                                    placeholder={`e.g. Welcome to ${data.name || 'our shop'}`}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="hero_title">Hero Heading</Label>
                                <Input
                                    id="hero_title"
                                    value={data.settings.hero_title}
                                    onChange={(e) => setData('settings', { ...data.settings, hero_title: e.target.value })}
                                    placeholder="e.g. Crafted for the modern aesthetic."
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="hero_cta_text">Hero Button CTA</Label>
                                <Input
                                    id="hero_cta_text"
                                    value={data.settings.hero_cta_text}
                                    onChange={(e) => setData('settings', { ...data.settings, hero_cta_text: e.target.value })}
                                    placeholder="e.g. Explore Collection"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="hero_image_desktop">
                                    Desktop Banner URL (Landscape 16:9)
                                    <span className="text-xs text-zinc-400 font-normal ml-1">Optional</span>
                                </Label>
                                <Input
                                    id="hero_image_desktop"
                                    value={data.settings.hero_image_desktop}
                                    onChange={(e) => setData('settings', { ...data.settings, hero_image_desktop: e.target.value })}
                                    placeholder="https://example.com/desktop-banner.jpg"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="hero_image_mobile">
                                    Mobile Banner URL (Portrait 9:16)
                                    <span className="text-xs text-zinc-400 font-normal ml-1">Optional</span>
                                </Label>
                                <Input
                                    id="hero_image_mobile"
                                    value={data.settings.hero_image_mobile}
                                    onChange={(e) => setData('settings', { ...data.settings, hero_image_mobile: e.target.value })}
                                    placeholder="https://example.com/mobile-banner.jpg"
                                />
                            </div>
                        </div>

                        <DialogFooter className="mt-4 gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsAddOpen(false);
                                    setEditItem(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={processing}>
                                {processing ? 'Saving...' : editItem ? 'Update Shop' : 'Create Shop'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Shop</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this shop? This will delete associated products and orders. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 mt-4">
                        <Button variant="outline" onClick={() => setDeleteId(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
