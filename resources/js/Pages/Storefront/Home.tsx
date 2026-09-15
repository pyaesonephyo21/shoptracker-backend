import React from 'react';
import { Head, Link } from '@inertiajs/react';
import StorefrontLayout from '@/Layouts/StorefrontLayout';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, ShoppingBag, ChevronDown } from 'lucide-react';

interface HomeProps {
    shop: { name: string; slug: string; settings?: any };
    categories: Array<{ id: number; name: string }>;
    featuredProducts: Array<any>;
    heroProduct?: any;
}

export default function Home({ shop, categories, featuredProducts, heroProduct: explicitHeroProduct }: HomeProps) {
    const { scrollY } = useScroll();

    // Parallax values for Hero
    const heroY = useTransform(scrollY, [0, 500], [0, 100]);
    const heroOpacity = useTransform(scrollY, [0, 350], [1, 0]);

    const heroSubtitle = shop.settings?.hero_subtitle || `Welcome to ${shop.name}`;
    const heroTitle = shop.settings?.hero_title || 'Crafted for the modern aesthetic';
    const heroCta = shop.settings?.hero_cta_text || 'Explore Collection';

    const heroProduct = explicitHeroProduct || featuredProducts?.[0] || null;
    const heroImg = heroProduct?.image_url || heroProduct?.media?.[0]?.original_url;
    const heroPrice = heroProduct?.variants?.[0]?.retail_price || heroProduct?.retail_price || 0;

    const scrollToGallery = () => {
        document.getElementById('fresh-drops')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <StorefrontLayout shop={shop}>
            <Head title={`${shop.name} | Home`} />

            {/* Hero Section (Responsive Mobile & PC Viewports) */}
            <section className="relative min-h-[100dvh] w-full flex flex-col justify-between overflow-hidden bg-[var(--store-bg)] text-[var(--store-text)] px-4 sm:px-6 md:px-12 pt-20 pb-6 sm:pb-8">
                
                {/* Abstract Ambient Glow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 0.35, scale: 1 }}
                        transition={{ duration: 1.8, ease: "easeOut" }}
                        className="absolute -top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-gradient-to-tr from-indigo-500/20 to-rose-500/20 rounded-full blur-3xl"
                    />
                </div>

                {/* Main Content Area */}
                <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col justify-center relative z-10 py-4 sm:py-8">
                    
                    {/* Desktop (PC) Layout: 2-Column Split Hero */}
                    <div className="hidden md:grid md:grid-cols-12 md:gap-8 lg:gap-16 items-center">
                        <div className="md:col-span-7 flex flex-col items-start text-left">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/10 backdrop-blur-md text-xs font-bold uppercase tracking-widest text-[var(--store-text)] mb-6 shadow-xs"
                            >
                                {heroSubtitle}
                            </motion.div>

                            <motion.h1
                                initial={{ opacity: 0, y: 25 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.7, delay: 0.2 }}
                                className="text-5xl lg:text-7xl font-black tracking-tight mb-8 leading-[1.08] text-[var(--store-text)]"
                            >
                                {heroTitle}
                            </motion.h1>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.7, delay: 0.3 }}
                                className="flex items-center gap-4"
                            >
                                <Link
                                    href={`/${shop.slug}/products`}
                                    style={{ backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' }}
                                    className="group relative inline-flex items-center justify-center px-8 py-4 text-base lg:text-lg font-bold rounded-full overflow-hidden transition-all hover:scale-105 shadow-xl active:scale-95"
                                >
                                    <span className="relative z-10 flex items-center gap-2">
                                        {heroCta} <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                </Link>
                            </motion.div>
                        </div>

                        {/* Desktop Featured Product Spotlight Card */}
                        {heroProduct && (
                            <div className="md:col-span-5 flex justify-center">
                                <motion.div
                                    initial={{ opacity: 0, y: 30, rotate: -2 }}
                                    animate={{ opacity: 1, y: 0, rotate: 0 }}
                                    transition={{ duration: 0.9, delay: 0.2 }}
                                    whileHover={{ scale: 1.03, y: -6 }}
                                    style={{ backgroundColor: 'var(--store-card)' }}
                                    className="relative w-full max-w-[340px] lg:max-w-[380px] aspect-[4/5] rounded-3xl p-3 border border-white/15 shadow-2xl overflow-hidden group cursor-pointer"
                                >
                                    <Link href={`/${shop.slug}/products`} className="w-full h-full flex flex-col">
                                        <div className="relative w-full flex-1 rounded-2xl overflow-hidden bg-black/40 flex items-center justify-center">
                                            {heroImg ? (
                                                <img
                                                    src={heroImg}
                                                    alt={heroProduct.name}
                                                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                                                />
                                            ) : (
                                                <ShoppingBag className="w-16 h-16 opacity-40 text-white" />
                                            )}
                                            <span 
                                                style={{ backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' }}
                                                className="absolute top-3 left-3 text-[11px] font-black px-3 py-1 rounded-full shadow-xs"
                                            >
                                                🔥 Featured Drop
                                            </span>
                                        </div>
                                        <div className="pt-3 px-1 flex justify-between items-center">
                                            <div className="truncate pr-2">
                                                <h3 className="font-black text-base truncate text-[var(--store-text)]">{heroProduct.name}</h3>
                                                <span className="text-xs opacity-70 text-[var(--store-text)]">{heroProduct.category?.name || 'New Arrival'}</span>
                                            </div>
                                            <span 
                                                style={{ backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' }}
                                                className="font-black text-sm px-3 py-1 rounded-full shrink-0 shadow-xs"
                                            >
                                                {Number(heroPrice).toLocaleString()} MMK
                                            </span>
                                        </div>
                                    </Link>
                                </motion.div>
                            </div>
                        )}
                    </div>

                    {/* Mobile (Portrait) Layout */}
                    <div className="md:hidden flex flex-col items-center text-center gap-4 my-auto">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4 }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border border-white/15 bg-white/10 backdrop-blur-md text-[10px] font-bold uppercase tracking-widest text-[var(--store-text)] shadow-xs"
                        >
                            {heroSubtitle}
                        </motion.div>

                        <motion.h1
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.1 }}
                            className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.12] text-[var(--store-text)]"
                        >
                            {heroTitle}
                        </motion.h1>

                        {/* Mobile Floating Spotlight Product */}
                        {heroProduct && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
                                transition={{
                                    opacity: { duration: 0.5, delay: 0.2 },
                                    scale: { duration: 0.5, delay: 0.2 },
                                    y: { repeat: Infinity, duration: 3.5, ease: "easeInOut" }
                                }}
                                style={{ backgroundColor: 'var(--store-card)' }}
                                className="relative w-[230px] sm:w-[260px] aspect-[4/5] max-h-[270px] rounded-2xl p-2.5 border border-white/15 shadow-2xl overflow-hidden group my-1"
                            >
                                <Link href={`/${shop.slug}/products`} className="w-full h-full flex flex-col">
                                    <div className="relative w-full flex-1 rounded-xl overflow-hidden bg-black/40 flex items-center justify-center">
                                        {heroImg ? (
                                            <img src={heroImg} alt={heroProduct.name} className="w-full h-full object-cover object-center" />
                                        ) : (
                                            <ShoppingBag className="w-10 h-10 opacity-40 text-white" />
                                        )}
                                        <span 
                                            style={{ backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' }}
                                            className="absolute top-2 left-2 text-[9px] font-black px-2.5 py-0.5 rounded-full"
                                        >
                                            🔥 Featured Drop
                                        </span>
                                    </div>
                                    <div className="pt-2 px-1 flex justify-between items-center text-left">
                                        <div className="truncate pr-2">
                                            <h3 className="font-bold text-xs truncate text-[var(--store-text)]">{heroProduct.name}</h3>
                                            <span className="text-[10px] opacity-70 text-[var(--store-text)]">{heroProduct.category?.name || 'New Arrival'}</span>
                                        </div>
                                        <span 
                                            style={{ backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' }}
                                            className="font-black text-[11px] px-2.5 py-0.5 rounded-full shrink-0"
                                        >
                                            {Number(heroPrice).toLocaleString()} MMK
                                        </span>
                                    </div>
                                </Link>
                            </motion.div>
                        )}

                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.3 }}
                        >
                            <Link
                                href={`/${shop.slug}/products`}
                                style={{ backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' }}
                                className="group relative inline-flex items-center justify-center px-7 py-3 text-sm font-bold rounded-full overflow-hidden transition-all hover:scale-105 shadow-xl active:scale-95"
                            >
                                <span className="relative z-10 flex items-center gap-2">
                                    {heroCta} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Link>
                        </motion.div>
                    </div>
                </div>

                {/* Floating Animated Scroll Down Cue */}
                <motion.button
                    onClick={scrollToGallery}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: [0, 6, 0] }}
                    transition={{
                        opacity: { duration: 0.8, delay: 0.7 },
                        y: { repeat: Infinity, duration: 2.2, ease: "easeInOut", delay: 0.9 }
                    }}
                    className="relative z-20 flex flex-col items-center gap-1 group cursor-pointer opacity-70 hover:opacity-100 transition-opacity self-center mt-2"
                    aria-label="Scroll to products"
                >
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-[var(--store-text)]">
                        Scroll to explore
                    </span>
                    <div className="w-5 h-8 rounded-full border border-white/30 group-hover:border-white/60 flex items-start justify-center p-1 transition-colors backdrop-blur-xs bg-white/5">
                        <motion.div
                            animate={{ y: [0, 10, 0] }}
                            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                            style={{ backgroundColor: 'var(--store-accent)' }}
                            className="w-1 h-1.5 rounded-full shadow-xs"
                        />
                    </div>
                    <ChevronDown className="w-3 h-3 text-[var(--store-text)] -mt-0.5" />
                </motion.button>
            </section>

            {/* New Arrivals / Fresh Drops Gallery */}
            <section id="fresh-drops" className="py-16 sm:py-24 px-6 md:px-12 max-w-7xl mx-auto scroll-mt-12">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6 }}
                    className="flex justify-between items-end mb-8 sm:mb-12"
                >
                    <div>
                        <span className="text-xs font-black uppercase tracking-widest opacity-60 text-[var(--store-text)] block mb-1">Fresh Drops</span>
                        <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-[var(--store-text)]">New Arrivals</h2>
                    </div>
                    <Link href={`/${shop.slug}/products`} className="text-xs sm:text-sm font-bold hover:underline flex items-center gap-1 text-[var(--store-text)]">
                        View All <ArrowRight className="w-4 h-4" />
                    </Link>
                </motion.div>

                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                    {featuredProducts.map((product, i) => {
                        const img = product.image_url || product.media?.[0]?.original_url;
                        const price = product.variants?.[0]?.retail_price || product.retail_price || 0;

                        return (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.4, delay: i * 0.05 }}
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

                    {featuredProducts.length === 0 && (
                        <div className="col-span-full py-20 text-center opacity-70 border border-dashed border-white/20 rounded-2xl">
                            No products available in this shop yet.
                        </div>
                    )}
                </div>
            </section>
        </StorefrontLayout >
    );
}
