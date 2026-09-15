import React, { useEffect, useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import ManagementHeader from '@/components/ManagementHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Check, Copy, Sparkles, Palette, ShoppingBag, Eye } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

interface ThemePreset {
    id: string;
    name: string;
    bg: string;
    text: string;
    accent: string;
    card: string;
}

const THEME_PRESETS: ThemePreset[] = [
    { id: 'obsidian', name: 'Obsidian Midnight', bg: '#09090b', text: '#f4f4f5', accent: '#ffffff', card: '#18181b' },
    { id: 'minimal_light', name: 'Minimalist Pure Light', bg: '#ffffff', text: '#09090b', accent: '#09090b', card: '#f4f4f5' },
    { id: 'espresso', name: 'Luxury Espresso', bg: '#181411', text: '#fef3c7', accent: '#f59e0b', card: '#28211c' },
    { id: 'sapphire', name: 'Sapphire Midnight', bg: '#0b1120', text: '#e2e8f0', accent: '#38bdf8', card: '#1e293b' },
    { id: 'velvet_rose', name: 'Velvet Rose', bg: '#181114', text: '#fce7f3', accent: '#f43f5e', card: '#27171d' },
    { id: 'emerald', name: 'Emerald Forest', bg: '#061e16', text: '#ecfdf5', accent: '#10b981', card: '#0d2e23' },
];

interface StorefrontSettingsProps {
    shop: {
        id: number;
        name: string;
        slug: string;
        currency_code: string;
        settings?: {
            announcement?: string;
            hero_subtitle?: string;
            hero_title?: string;
            hero_cta_text?: string;
            featured_product_id?: number | null;
            theme?: {
                preset?: string;
                background_color?: string;
                text_color?: string;
                accent_color?: string;
                card_bg?: string;
            };
        };
    };
    products: Array<{
        id: number;
        name: string;
        retail_price: number;
        category?: { id: number; name: string };
        image_url?: string;
        media?: Array<{ original_url: string }>;
    }>;
}

interface StorefrontFormData {
    name: string;
    slug: string;
    currency_code: string;
    settings: {
        announcement: string;
        hero_subtitle: string;
        hero_title: string;
        hero_cta_text: string;
        featured_product_id: number | null;
        theme: {
            preset: string;
            background_color: string;
            text_color: string;
            accent_color: string;
            card_bg: string;
        };
    };
}

export default function StorefrontSettings({ shop, products }: StorefrontSettingsProps) {
    const [copied, setCopied] = useState(false);

    const initialTheme = shop.settings?.theme || {
        preset: 'obsidian',
        background_color: '#09090b',
        text_color: '#f4f4f5',
        accent_color: '#ffffff',
        card_bg: '#18181b',
    };

    const { data, setData, post, processing, errors, recentlySuccessful } = useForm<StorefrontFormData>({
        name: shop.name || '',
        slug: shop.slug || '',
        currency_code: shop.currency_code || 'MMK',
        settings: {
            announcement: shop.settings?.announcement || '',
            hero_subtitle: shop.settings?.hero_subtitle || '',
            hero_title: shop.settings?.hero_title || '',
            hero_cta_text: shop.settings?.hero_cta_text || '',
            featured_product_id: shop.settings?.featured_product_id ?? null,
            theme: {
                preset: initialTheme.preset || 'obsidian',
                background_color: initialTheme.background_color || '#09090b',
                text_color: initialTheme.text_color || '#f4f4f5',
                accent_color: initialTheme.accent_color || '#ffffff',
                card_bg: initialTheme.card_bg || '#18181b',
            },
        },
    });

    // Synchronize form values whenever the active shop changes (e.g. via top-left shop switcher)
    useEffect(() => {
        const currentTheme = shop.settings?.theme || {
            preset: 'obsidian',
            background_color: '#09090b',
            text_color: '#f4f4f5',
            accent_color: '#ffffff',
            card_bg: '#18181b',
        };

        setData({
            name: shop.name || '',
            slug: shop.slug || '',
            currency_code: shop.currency_code || 'MMK',
            settings: {
                announcement: shop.settings?.announcement || '',
                hero_subtitle: shop.settings?.hero_subtitle || '',
                hero_title: shop.settings?.hero_title || '',
                hero_cta_text: shop.settings?.hero_cta_text || '',
                featured_product_id: shop.settings?.featured_product_id ?? null,
                theme: {
                    preset: currentTheme.preset || 'obsidian',
                    background_color: currentTheme.background_color || '#09090b',
                    text_color: currentTheme.text_color || '#f4f4f5',
                    accent_color: currentTheme.accent_color || '#ffffff',
                    card_bg: currentTheme.card_bg || '#18181b',
                },
            },
        });
    }, [shop.id, shop.slug, shop.name, JSON.stringify(shop.settings)]);

    const handleApplyPreset = (preset: ThemePreset) => {
        setData('settings', {
            ...data.settings,
            theme: {
                preset: preset.id,
                background_color: preset.bg,
                text_color: preset.text,
                accent_color: preset.accent,
                card_bg: preset.card,
            },
        });
    };

    const handleCopyUrl = () => {
        const url = `${window.location.origin}/${data.slug || shop.slug}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/management/storefront', {
            preserveScroll: true,
        });
    };

    const selectedProduct = products.find((p) => p.id.toString() === data.settings.featured_product_id?.toString()) || products[0];

    const currentBg = data.settings.theme.background_color || '#09090b';
    const currentText = data.settings.theme.text_color || '#f4f4f5';
    const currentAccent = data.settings.theme.accent_color || '#ffffff';
    const currentCard = data.settings.theme.card_bg || '#18181b';

    return (
        <AppLayout>
            <Head title="Storefront Customizer" />

            <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-16">
                <ManagementHeader />

                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* Left Column: Real-Time Preview Simulator (lg:col-span-5) */}
                    <div className="lg:col-span-5 lg:sticky lg:top-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                                <Eye className="w-3.5 h-3.5" /> Live Storefront Preview
                            </span>
                            <span className="text-[11px] font-mono text-zinc-400">/{data.slug || shop.slug}</span>
                        </div>

                        {/* Mobile Simulator Frame */}
                        <div
                            style={{ backgroundColor: currentBg, color: currentText }}
                            className="rounded-3xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-2xl transition-colors duration-300 flex flex-col gap-4 overflow-hidden relative min-h-[440px] text-center"
                        >
                            {/* Top Announcement Simulation */}
                            {data.settings.announcement && (
                                <div className="text-[10px] font-bold py-1 px-3 rounded-md bg-white/10 text-center tracking-wide">
                                    {data.settings.announcement}
                                </div>
                            )}

                            {/* Simulated Navbar */}
                            <div className="flex justify-between items-center pb-3 border-b border-white/10">
                                <span className="font-black text-sm">{data.name || shop.name}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
                                        🛒
                                    </div>
                                </div>
                            </div>

                            {/* Simulated Hero */}
                            <div className="flex flex-col items-center gap-3 my-auto py-2">
                                <span className="text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border border-white/15 bg-white/10">
                                    {data.settings.hero_subtitle || `Welcome to ${data.name || shop.name}`}
                                </span>

                                <h2 className="font-black text-xl leading-tight">
                                    {data.settings.hero_title || 'Crafted for the modern aesthetic'}
                                </h2>

                                {/* Simulated Spotlight Product */}
                                {selectedProduct && (
                                    <div
                                        style={{ backgroundColor: currentCard }}
                                        className="w-[180px] aspect-[4/5] rounded-2xl p-2 border border-white/15 shadow-lg flex flex-col overflow-hidden my-1 text-left transition-colors"
                                    >
                                        <div className="w-full flex-1 rounded-xl bg-zinc-900 overflow-hidden flex items-center justify-center relative">
                                            {selectedProduct.image_url || selectedProduct.media?.[0]?.original_url ? (
                                                <img
                                                    src={selectedProduct.image_url || selectedProduct.media?.[0]?.original_url}
                                                    alt={selectedProduct.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <ShoppingBag className="w-8 h-8 opacity-40 text-white" />
                                            )}
                                            <span className="absolute top-1.5 left-1.5 bg-black/80 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                                                🔥 Spotlight
                                            </span>
                                        </div>
                                        <div className="pt-2 px-1 flex justify-between items-center">
                                            <span className="font-bold text-[11px] truncate text-white">{selectedProduct.name}</span>
                                            <span
                                                style={{ backgroundColor: currentAccent, color: currentBg }}
                                                className="font-black text-[9px] px-1.5 py-0.5 rounded-full shrink-0"
                                            >
                                                {Number(selectedProduct.retail_price || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Simulated CTA */}
                                <div
                                    style={{ backgroundColor: currentAccent, color: currentBg }}
                                    className="px-5 py-2 rounded-full text-xs font-black shadow-md mt-1"
                                >
                                    {data.settings.hero_cta_text || 'Explore Collection'} →
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Customization Controls (lg:col-span-7) */}
                    <div className="lg:col-span-7 flex flex-col gap-6">

                        {/* Section 1: Color Themes & Palettes */}
                        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col gap-5">
                            <div className="flex items-center gap-2">
                                <Palette className="w-4 h-4 text-zinc-500" />
                                <h3 className="font-black text-sm uppercase tracking-wider">Theme & Color Palette</h3>
                            </div>

                            {/* 1-Click Curated Presets */}
                            <div className="flex flex-col gap-2">
                                <Label className="text-xs text-zinc-500">1-Click Curated Presets</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                    {THEME_PRESETS.map((preset) => {
                                        const isSelected = data.settings.theme.preset === preset.id;
                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                onClick={() => handleApplyPreset(preset)}
                                                className={twMerge(
                                                    "p-3 rounded-xl border text-left flex flex-col gap-2 transition-all active:scale-95 shadow-xs",
                                                    isSelected
                                                        ? "border-black dark:border-white ring-2 ring-black dark:ring-white bg-white dark:bg-zinc-950"
                                                        : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-400"
                                                )}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ backgroundColor: preset.bg }} />
                                                    <span className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ backgroundColor: preset.card }} />
                                                    <span className="w-3.5 h-3.5 rounded-full border border-black/20" style={{ backgroundColor: preset.accent }} />
                                                </div>
                                                <span className="text-xs font-bold truncate">{preset.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom Hex Color Pickers */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="bg_color" className="text-xs">Background</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            id="bg_color"
                                            value={data.settings.theme.background_color}
                                            onChange={(e) => setData('settings', {
                                                ...data.settings,
                                                theme: { ...data.settings.theme, preset: 'custom', background_color: e.target.value }
                                            })}
                                            className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                                        />
                                        <Input
                                            value={data.settings.theme.background_color}
                                            onChange={(e) => setData('settings', {
                                                ...data.settings,
                                                theme: { ...data.settings.theme, preset: 'custom', background_color: e.target.value }
                                            })}
                                            className="h-8 font-mono text-xs px-2"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="text_color" className="text-xs">Text</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            id="text_color"
                                            value={data.settings.theme.text_color}
                                            onChange={(e) => setData('settings', {
                                                ...data.settings,
                                                theme: { ...data.settings.theme, preset: 'custom', text_color: e.target.value }
                                            })}
                                            className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                                        />
                                        <Input
                                            value={data.settings.theme.text_color}
                                            onChange={(e) => setData('settings', {
                                                ...data.settings,
                                                theme: { ...data.settings.theme, preset: 'custom', text_color: e.target.value }
                                            })}
                                            className="h-8 font-mono text-xs px-2"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="accent_color" className="text-xs">Accent / Buttons</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            id="accent_color"
                                            value={data.settings.theme.accent_color}
                                            onChange={(e) => setData('settings', {
                                                ...data.settings,
                                                theme: { ...data.settings.theme, preset: 'custom', accent_color: e.target.value }
                                            })}
                                            className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                                        />
                                        <Input
                                            value={data.settings.theme.accent_color}
                                            onChange={(e) => setData('settings', {
                                                ...data.settings,
                                                theme: { ...data.settings.theme, preset: 'custom', accent_color: e.target.value }
                                            })}
                                            className="h-8 font-mono text-xs px-2"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="card_bg" className="text-xs">Card Surface</Label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            id="card_bg"
                                            value={data.settings.theme.card_bg}
                                            onChange={(e) => setData('settings', {
                                                ...data.settings,
                                                theme: { ...data.settings.theme, preset: 'custom', card_bg: e.target.value }
                                            })}
                                            className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0 bg-transparent"
                                        />
                                        <Input
                                            value={data.settings.theme.card_bg}
                                            onChange={(e) => setData('settings', {
                                                ...data.settings,
                                                theme: { ...data.settings.theme, preset: 'custom', card_bg: e.target.value }
                                            })}
                                            className="h-8 font-mono text-xs px-2"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Hero Spotlight Product Selector */}
                        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                <h3 className="font-black text-sm uppercase tracking-wider">Hero Spotlight Drop</h3>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="featured_product">Select Featured Product to Showcase in Hero</Label>
                                <select
                                    id="featured_product"
                                    value={data.settings.featured_product_id || ''}
                                    onChange={(e) => setData('settings', { ...data.settings, featured_product_id: e.target.value ? Number(e.target.value) : null })}
                                    className="w-full py-2.5 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white shadow-xs"
                                >
                                    <option value="">⚡ Automatic (Latest Drop with image)</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} — {Number(p.retail_price || 0).toLocaleString()} MMK {p.category ? `(${p.category.name})` : ''}
                                        </option>
                                    ))}
                                </select>
                                <span className="text-xs text-zinc-400">This product is highlighted front-and-center in your 3D Hero Spotlight.</span>
                            </div>
                        </div>

                        {/* Section 3: Hero Content & Announcement */}
                        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col gap-4">
                            <h3 className="font-black text-sm uppercase tracking-wider text-zinc-900 dark:text-zinc-100">Hero Headlines & Texts</h3>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="announcement">Top Announcement Bar (Optional)</Label>
                                <Input
                                    id="announcement"
                                    value={data.settings.announcement}
                                    onChange={(e) => setData('settings', { ...data.settings, announcement: e.target.value })}
                                    placeholder="e.g. Free shipping on orders over 50,000 MMK"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="hero_subtitle">Hero Badge / Subtitle</Label>
                                <Input
                                    id="hero_subtitle"
                                    value={data.settings.hero_subtitle}
                                    onChange={(e) => setData('settings', { ...data.settings, hero_subtitle: e.target.value })}
                                    placeholder={`e.g. Welcome to ${data.name || shop.name}`}
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="hero_title">Hero Main Heading</Label>
                                <Input
                                    id="hero_title"
                                    value={data.settings.hero_title}
                                    onChange={(e) => setData('settings', { ...data.settings, hero_title: e.target.value })}
                                    placeholder="e.g. Crafted for the modern aesthetic"
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
                        </div>

                        {/* Section 4: Storefront Identity & Slug */}
                        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col gap-4">
                            <h3 className="font-black text-sm uppercase tracking-wider text-zinc-900 dark:text-zinc-100">Shop Identity & URL</h3>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="name">Shop Name</Label>
                                    <Input
                                        id="name"
                                        value={data.name}
                                        onChange={(e) => setData('name', e.target.value)}
                                        required
                                    />
                                    {errors.name && <span className="text-xs text-red-500">{errors.name}</span>}
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="currency_code">Currency Code</Label>
                                    <Input
                                        id="currency_code"
                                        value={data.currency_code}
                                        onChange={(e) => setData('currency_code', e.target.value)}
                                        placeholder="MMK, USD, THB"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="slug">Public Storefront Slug</Label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3">
                                        <span className="text-xs text-zinc-400 font-mono select-none">/</span>
                                        <Input
                                            id="slug"
                                            value={data.slug}
                                            onChange={(e) => setData('slug', e.target.value)}
                                            className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 font-mono text-xs"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCopyUrl}
                                        className="h-9 px-3 gap-1 text-xs font-bold shrink-0"
                                    >
                                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copied ? 'Copied' : 'Copy Link'}</span>
                                    </Button>
                                </div>
                                {errors.slug && <span className="text-xs text-red-500">{errors.slug}</span>}
                            </div>
                        </div>

                        {/* Save Action Bar */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            {recentlySuccessful && (
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <Check className="w-4 h-4" /> Saved successfully!
                                </span>
                            )}
                            <Button
                                type="submit"
                                disabled={processing}
                                className="px-8 font-black shadow-lg"
                            >
                                {processing ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </AppLayout>
    );
}
