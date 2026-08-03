import React, { useState, useEffect } from 'react';
import { Link, usePage, router } from '@inertiajs/react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GlobalToast } from '@/components/GlobalToast';

interface NavItem {
    name: string;
    href: string;
    icon: React.ReactNode;
}

const HomeIcon = () => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
);
const SalesIcon = () => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /></svg>
);
const InventoryIcon = () => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
);
const ManagementIcon = () => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
);
const FinanceIcon = () => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
);

const NAV_ITEMS: NavItem[] = [
    { name: 'Dashboard', href: '/', icon: <HomeIcon /> },
    { name: 'Sales', href: '/sales', icon: <SalesIcon /> },
    { name: 'Inventory', href: '/inventory', icon: <InventoryIcon /> },
    { name: 'Finance', href: '/finance/cash-flow', icon: <FinanceIcon /> },
    { name: 'Management', href: '/management', icon: <ManagementIcon /> },
];

export default function AppLayout({ children, title }: { children: React.ReactNode; title?: string }) {
    const { url, props } = usePage<any>();
    const { auth } = props;

    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
    const [showReconnected, setShowReconnected] = useState(false);

    // Refresh & Pull-to-Refresh State
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullDistance, setPullDistance] = useState(0);
    const [isPulling, setIsPulling] = useState(false);
    const touchStartY = React.useRef(0);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    const handleRefresh = () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            navigator.vibrate?.(15);
        }
        router.reload({
            preserveScroll: true,
            onFinish: () => {
                setTimeout(() => {
                    setIsRefreshing(false);
                    setPullDistance(0);
                    setIsPulling(false);
                }, 400);
            }
        });
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
            touchStartY.current = e.touches[0].clientY;
            setIsPulling(true);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isPulling || isRefreshing) return;
        if (scrollContainerRef.current && scrollContainerRef.current.scrollTop === 0) {
            const currentY = e.touches[0].clientY;
            const diff = currentY - touchStartY.current;
            if (diff > 0) {
                // Apply elastic resistance
                const distance = Math.min(diff * 0.45, 80);
                setPullDistance(distance);
            } else {
                setPullDistance(0);
            }
        }
    };

    const handleTouchEnd = () => {
        if (pullDistance > 50 && !isRefreshing) {
            handleRefresh();
        } else {
            setPullDistance(0);
            setIsPulling(false);
        }
    };

    useEffect(() => {
        const handleOnline = () => {
            setIsOffline(false);
            setShowReconnected(true);
            const timer = setTimeout(() => setShowReconnected(false), 3000);
            return () => clearTimeout(timer);
        };
        const handleOffline = () => {
            setIsOffline(true);
            setShowReconnected(false);
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Pre-warm core routes into cache when idle
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => {
                try {
                    router.prefetch('/sales', { method: 'get' }, { cacheFor: '2m' });
                    router.prefetch('/inventory', { method: 'get' }, { cacheFor: '2m' });
                    router.prefetch('/finance/cash-flow', { method: 'get' }, { cacheFor: '2m' });
                } catch (e) {
                    // prefetch optional
                }
            });
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div className="flex h-screen w-full bg-white text-black selection:bg-black selection:text-white dark:bg-black dark:text-white dark:selection:bg-white dark:selection:text-black font-sans antialiased flex-col md:flex-row">
            {/* Real-time Network Status Banner */}
            {isOffline && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-black text-xs font-bold px-4 py-1.5 text-center flex items-center justify-center gap-2 shadow-md">
                    <span className="w-2 h-2 rounded-full bg-black animate-pulse"></span>
                    <span>You are offline. Showing cached data — reconnecting...</span>
                </div>
            )}
            {showReconnected && (
                <div className="fixed top-0 left-0 right-0 z-50 bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 text-center flex items-center justify-center gap-2 shadow-md animate-in fade-in slide-in-from-top-2">
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                    <span>Connection restored. Online.</span>
                </div>
            )}

            {/* Desktop / Tablet Sidebar */}
            <aside className={twMerge(
                "hidden md:flex flex-col border-r border-zinc-200 dark:border-zinc-800 h-full p-4 shrink-0 bg-zinc-50 dark:bg-zinc-950 transition-all duration-300 relative",
                isSidebarCollapsed ? "w-20 items-center px-2" : "w-64"
            )}>
                {/* Floating Collapse Button */}
                <button 
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                    className="absolute -right-3 top-12 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full w-6 h-6 flex items-center justify-center shadow-sm z-50 text-zinc-400 hover:text-black dark:hover:text-white hover:scale-110 transition-all"
                    title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                >
                    {isSidebarCollapsed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    )}
                </button>

                <div className={twMerge("mb-8 flex flex-col gap-1", isSidebarCollapsed ? "px-0 items-center" : "px-4")}>
                    {isSidebarCollapsed ? (
                        <div className="w-12 h-12 flex items-center justify-center bg-black dark:bg-white text-white dark:text-black rounded-xl font-black text-xl shadow-sm">
                            {auth?.shop?.name?.[0]?.toUpperCase() || 'S'}
                        </div>
                    ) : (
                        auth?.all_shops?.length > 1 ? (
                            <div className="mt-1 mb-2 w-full">
                                <Select value={auth.shop?.id?.toString()} onValueChange={(val) => router.post('/switch-shop', { shop_id: val })}>
                                    <SelectTrigger className="w-fit justify-start font-black text-2xl sm:text-3xl border-none p-0 h-auto focus:ring-0 focus:ring-offset-0 bg-transparent uppercase tracking-tight shadow-none flex items-center gap-1.5 max-w-full">
                                        <span className="truncate">{auth.shop?.name}</span>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {auth.all_shops?.map((s: any) => (
                                             <SelectItem key={s.id} value={s.id.toString()} className="font-bold">{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-[10px] uppercase font-bold text-white tracking-widest bg-black dark:bg-white dark:text-black px-2 py-0.5 rounded-full inline-block mt-1 border border-black dark:border-white truncate max-w-full">
                                    {auth.user?.name}
                                </span>
                            </div>
                        ) : (
                            <div className="w-full overflow-hidden">
                                <h1 className="text-xl font-black tracking-tight truncate">{auth?.shop?.name || 'ShopTracker'}</h1>
                                {auth?.user && (
                                    <div className="mt-1">
                                        <span className="text-[9px] uppercase font-bold text-white tracking-widest bg-black dark:bg-white dark:text-black px-2 py-0.5 rounded-full inline-block border border-black dark:border-white truncate max-w-full">
                                            {auth.user.name}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )
                    )}
                </div>
                <nav className={twMerge("flex flex-col gap-2 flex-1 w-full", isSidebarCollapsed ? "items-center" : "")}>
                    {NAV_ITEMS.map((item) => {
                        const isActive = url === item.href || (item.href !== '/' && url.startsWith(item.href));
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                prefetch={['mount', 'hover']}
                                cacheFor="1m"
                                className={twMerge(
                                    'flex items-center rounded-xl transition-all duration-200 group active:scale-[0.98]',
                                    isSidebarCollapsed ? 'p-3 justify-center w-12 h-12' : 'px-4 py-3 gap-3 w-full',
                                    isActive
                                        ? 'bg-black text-white dark:bg-white dark:text-black font-medium'
                                        : 'text-zinc-600 hover:bg-zinc-200 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
                                )}
                                title={isSidebarCollapsed ? item.name : undefined}
                            >
                                <span className={clsx("transition-transform group-active:scale-95", isActive ? "" : "opacity-70")}>{item.icon}</span>
                                {!isSidebarCollapsed && <span>{item.name}</span>}
                            </Link>
                        );
                    })}
                </nav>
                
                {/* Bottom Actions (Refresh & Logout) */}
                <div className={twMerge("mt-auto border-t border-zinc-200 dark:border-zinc-800 pt-4 flex flex-col gap-2 w-full", isSidebarCollapsed ? "items-center" : "")}>
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className={twMerge(
                            "flex items-center rounded-xl text-left text-zinc-600 hover:bg-zinc-200 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-all group",
                            isSidebarCollapsed ? "w-12 h-12 p-3 justify-center" : "w-full px-4 py-3 gap-3"
                        )}
                        title={isSidebarCollapsed ? "Refresh" : undefined}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={twMerge("opacity-70 group-hover:opacity-100 transition-transform duration-500", isRefreshing && "animate-spin text-black dark:text-white opacity-100")}><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
                        {!isSidebarCollapsed && <span className="font-medium">{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>}
                    </button>

                    {auth?.user && (
                        <Link 
                            href="/logout" 
                            method="post" 
                            as="button" 
                            className={twMerge(
                                "flex items-center rounded-xl text-left text-zinc-600 hover:bg-zinc-200 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors group",
                                isSidebarCollapsed ? "w-12 h-12 p-3 justify-center" : "w-full px-4 py-3 gap-3"
                            )}
                            title={isSidebarCollapsed ? "Logout" : undefined}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70 group-hover:opacity-100 transition-opacity"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                            {!isSidebarCollapsed && <span className="font-medium">Logout</span>}
                        </Link>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white dark:bg-black">
                {/* Mobile Header with Safe Area Notch Padding & Quick Refresh */}
                <header className="md:hidden flex items-center justify-between min-h-16 pt-[env(safe-area-inset-top,0px)] px-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0 sticky top-0 bg-white/90 dark:bg-black/90 backdrop-blur-md z-10">
                    <div className="py-2 flex-1 min-w-0 pr-2">
                        {auth?.all_shops?.length > 1 ? (
                            <div className="flex flex-col">
                                <Select value={auth.shop?.id?.toString()} onValueChange={(val) => router.post('/switch-shop', { shop_id: val })}>
                                    <SelectTrigger className="w-fit justify-start font-black text-xl sm:text-2xl border-none p-0 h-auto focus:ring-0 focus:ring-offset-0 bg-transparent tracking-tight shadow-none flex items-center gap-1.5 max-w-[200px] sm:max-w-[300px]">
                                        <span className="truncate">{auth.shop?.name}</span>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {auth.all_shops?.map((s: any) => (
                                            <SelectItem key={s.id} value={s.id.toString()} className="font-bold">{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <div className="mt-0.5">
                                    <span className="text-[9px] uppercase font-bold text-white tracking-widest bg-black dark:bg-white dark:text-black px-2 py-0.5 rounded-full inline-block border border-black dark:border-white truncate max-w-full">
                                        {auth.user?.name}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                <h1 className="text-lg font-bold tracking-tight truncate">{title || auth?.shop?.name || 'ShopTracker'}</h1>
                                {auth?.user && (
                                    <div className="mt-0.5">
                                        <span className="text-[9px] uppercase font-bold text-white tracking-widest bg-black dark:bg-white dark:text-black px-2 py-0.5 rounded-full inline-block border border-black dark:border-white truncate max-w-full">
                                            {auth.user.name}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Header Right Actions: Refresh + Logout */}
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="p-2 rounded-lg text-zinc-500 hover:text-black dark:hover:text-white active:scale-90 transition-all"
                            title="Refresh page data"
                            aria-label="Refresh"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={twMerge("transition-transform duration-500", isRefreshing && "animate-spin text-black dark:text-white")}
                            >
                                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                <path d="M3 3v5h5" />
                                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                                <path d="M16 21h5v-5" />
                            </svg>
                        </button>
                        {auth?.user && (
                            <Link href="/logout" method="post" as="button" className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-black dark:hover:text-white py-2 px-2 rounded-lg active:scale-95">
                                Logout
                            </Link>
                        )}
                    </div>
                </header>

                <div 
                    ref={scrollContainerRef}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="flex-1 overflow-y-auto pb-24 md:pb-0 scroll-smooth relative"
                >
                    {/* Native Pull to Refresh Animated Indicator */}
                    {(pullDistance > 0 || isRefreshing) && (
                        <div 
                            className="md:hidden flex items-center justify-center transition-all duration-200 overflow-hidden w-full"
                            style={{ height: `${isRefreshing ? 48 : pullDistance}px` }}
                        >
                            <div className={twMerge(
                                "w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shadow-md",
                                pullDistance > 50 && "border-black dark:border-white scale-110"
                            )}>
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="16" 
                                    height="16" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2.5" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round" 
                                    className={twMerge(
                                        "text-zinc-600 dark:text-zinc-300 transition-transform duration-200", 
                                        isRefreshing ? "animate-spin text-black dark:text-white" : ""
                                    )}
                                    style={{ transform: isRefreshing ? undefined : `rotate(${pullDistance * 4.5}deg)` }}
                                >
                                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                                    <path d="M3 3v5h5" />
                                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                                    <path d="M16 21h5v-5" />
                                </svg>
                            </div>
                        </div>
                    )}

                    {/* Page Content */}
                    <div className="max-w-5xl mx-auto w-full p-4 md:p-8">
                        {children}
                    </div>
                </div>
            </main>

            {/* Mobile Bottom Tab Bar with Safe Area Bottom Padding */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-white/90 dark:bg-black/90 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around px-2 z-20">
                {NAV_ITEMS.map((item) => {
                    const isActive = url === item.href || (item.href !== '/' && url.startsWith(item.href));
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            prefetch={['mount', 'hover']}
                            cacheFor="1m"
                            className={twMerge(
                                'flex flex-col items-center justify-center w-full h-full gap-1 active:scale-95 transition-all',
                                isActive ? 'text-black dark:text-white font-bold' : 'text-zinc-500 dark:text-zinc-500'
                            )}
                        >
                            <span className={clsx("transition-all duration-300", isActive ? "scale-110" : "")}>
                                {item.icon}
                            </span>
                            <span className="text-[10px] font-medium tracking-wide">
                                {item.name}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* Global Toast Notification */}
            <GlobalToast />
        </div>
    );
}

