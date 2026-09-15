import React from 'react';
import { Link } from '@inertiajs/react';
import { ShoppingCart, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';

interface StorefrontLayoutProps {
    shop: { name: string; slug: string; settings?: any };
    children: React.ReactNode;
}

export default function StorefrontLayout({ shop, children }: StorefrontLayoutProps) {
    const [isScrolled, setIsScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const theme = shop.settings?.theme || {};
    const themeStyles = {
        '--store-bg': theme.background_color || '#09090b',
        '--store-text': theme.text_color || '#f4f4f5',
        '--store-accent': theme.accent_color || '#ffffff',
        '--store-card': theme.card_bg || '#18181b',
    } as React.CSSProperties;

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div 
            style={themeStyles} 
            className="min-h-screen bg-[var(--store-bg)] text-[var(--store-text)] font-sans flex flex-col transition-colors duration-300 selection:bg-[var(--store-accent)] selection:text-[var(--store-bg)]"
        >
            {/* Top Announcement Bar (Optional) */}
            {shop.settings?.announcement && (
                <div className="bg-[var(--store-card)] text-[var(--store-text)] text-center py-2 px-4 text-xs font-semibold tracking-wide border-b border-white/10 relative z-50">
                    {shop.settings.announcement}
                </div>
            )}

            {/* Header / Navbar */}
            <header 
                className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
                    shop.settings?.announcement ? (isScrolled ? 'top-0' : 'top-8') : 'top-0'
                } ${
                    isScrolled 
                        ? 'bg-[var(--store-bg)]/90 backdrop-blur-xl border-b border-white/10 py-3.5 shadow-sm text-[var(--store-text)]' 
                        : 'bg-gradient-to-b from-black/80 via-black/30 to-transparent py-4 text-white'
                }`}
            >
                <div className="max-w-7xl mx-auto px-6 md:px-12 flex justify-between items-center">
                    
                    {/* Logo Area */}
                    <Link href={`/${shop.slug}`} className="flex items-center gap-2.5 group">
                        <motion.div 
                            whileHover={{ rotate: 180 }} 
                            transition={{ duration: 0.5, ease: 'easeInOut' }}
                            style={{ backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' }}
                            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm font-black text-lg leading-none"
                        >
                            {shop.name.charAt(0).toUpperCase()}
                        </motion.div>
                        <span className="font-black text-xl tracking-tight group-hover:opacity-80 transition-opacity text-[var(--store-text)]">
                            {shop.name}
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[var(--store-text)]">
                        <Link href={`/${shop.slug}`} className="hover:opacity-75 transition-opacity">Home</Link>
                        <Link href={`/${shop.slug}/products`} className="hover:opacity-75 transition-opacity">Shop All</Link>
                        <Link href={`/${shop.slug}/products?filter=categories`} className="hover:opacity-75 transition-opacity">Categories</Link>
                    </nav>

                    {/* Actions Area */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button className="relative p-2.5 rounded-full hover:bg-white/10 transition-colors group text-[var(--store-text)]">
                            <ShoppingCart className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            <span 
                                style={{ backgroundColor: 'var(--store-accent)', color: 'var(--store-bg)' }}
                                className="absolute top-1 right-1 text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-xs"
                            >
                                0
                            </span>
                        </button>
                        
                        <button 
                            className="md:hidden p-2.5 rounded-full hover:bg-white/10 transition-colors text-[var(--store-text)]"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Toggle Navigation Menu"
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </header>

            {/* Mobile Navigation Drawer */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed inset-0 z-50 bg-zinc-950/98 backdrop-blur-2xl pt-24 px-8 md:hidden flex flex-col text-white"
                    >
                        <div className="flex justify-between items-center mb-8 pb-4 border-b border-zinc-800">
                            <span className="font-black text-2xl">{shop.name}</span>
                            <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-zinc-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <nav className="flex flex-col gap-6 text-2xl font-bold tracking-tight">
                            <Link href={`/${shop.slug}`} onClick={() => setMobileMenuOpen(false)} className="hover:text-zinc-400 transition-colors">Home</Link>
                            <Link href={`/${shop.slug}/products`} onClick={() => setMobileMenuOpen(false)} className="hover:text-zinc-400 transition-colors">Shop All</Link>
                            <Link href={`/${shop.slug}/products?filter=categories`} onClick={() => setMobileMenuOpen(false)} className="hover:text-zinc-400 transition-colors">Categories</Link>
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col w-full">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={window.location.pathname}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="flex-1 flex flex-col w-full"
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Footer */}
            <footer 
                style={{ backgroundColor: 'var(--store-card)', color: 'var(--store-text)' }}
                className="border-t border-white/10 py-12 mt-auto"
            >
                <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div className="md:col-span-2">
                        <span className="font-bold text-2xl tracking-tight block mb-4">{shop.name}</span>
                        <p className="text-sm opacity-70 max-w-sm leading-relaxed">
                            Premium products curated for modern lifestyles. Quality, design, and innovation in every piece.
                        </p>
                    </div>
                    <div>
                        <h4 className="font-bold mb-4 uppercase text-xs tracking-widest opacity-60">Shop</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link href={`/${shop.slug}/products`} className="opacity-80 hover:opacity-100 hover:underline">All Products</Link></li>
                            <li><Link href={`/${shop.slug}/products?filter=categories`} className="opacity-80 hover:opacity-100 hover:underline">Categories</Link></li>
                            <li><Link href={`/${shop.slug}/products?sort=latest`} className="opacity-80 hover:opacity-100 hover:underline">New Arrivals</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold mb-4 uppercase text-xs tracking-widest opacity-60">Support</h4>
                        <ul className="space-y-3 text-sm">
                            <li><a href="#" className="opacity-80 hover:opacity-100 hover:underline">Contact Us</a></li>
                            <li><a href="#" className="opacity-80 hover:opacity-100 hover:underline">FAQ</a></li>
                            <li><a href="#" className="opacity-80 hover:opacity-100 hover:underline">Shipping & Returns</a></li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-6 md:px-12 mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 text-xs opacity-60">
                    <p>&copy; {new Date().getFullYear()} {shop.name}. All rights reserved.</p>
                    <div className="flex gap-4">
                        <a href="#" className="hover:opacity-100 transition-opacity">Privacy</a>
                        <a href="#" className="hover:opacity-100 transition-opacity">Terms</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
