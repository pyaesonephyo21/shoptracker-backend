import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '../Layouts/AppLayout';
import { Head, router, Link } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';

interface DashboardProps {
    filters: {
        start_date: string;
        end_date: string;
    };
    metrics: {
        total_expenses: number;
        gross_profit: number;
        pending_orders_count: number;
        net_revenue: number;
        net_profit: number;
        inventory_cost: number;
        inventory_retail: number;
    };
    lowStockProducts: {
        items: {
            id: number;
            name: string;
            stock_quantity: number;
            pending_stock: number;
            retail_price: number;
        }[];
        total_count: number;
    };
    unsettledDeliveries: {
        items: {
            id: number;
            date: string;
            customer_name: string;
            courier_name: string;
            balance: number;
        }[];
        total_count: number;
    };
}

export default function Dashboard({ filters, metrics, lowStockProducts, unsettledDeliveries }: DashboardProps) {
    const [startDate, setStartDate] = useState<Date | undefined>(filters.start_date ? new Date(filters.start_date) : undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(filters.end_date ? new Date(filters.end_date) : undefined);

    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        router.get('/', { 
            start_date: startDate ? startDate.toISOString().split('T')[0] : undefined, 
            end_date: endDate ? endDate.toISOString().split('T')[0] : undefined 
        }, { preserveState: true, preserveScroll: true });
    }, [startDate, endDate]);

    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />

            <div className="flex flex-col gap-6 sm:gap-8 pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                            Overview
                        </h1>
                        <p className="text-sm font-medium text-zinc-500 mt-1">Financial & operations summary</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end gap-3 bg-zinc-50 dark:bg-zinc-900 p-2 sm:p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full lg:w-auto">

                        <div className="flex w-full sm:w-auto gap-3">
                            <div className="flex flex-col gap-1.5 flex-1 sm:flex-initial">
                                <Label className="text-[10px] uppercase text-zinc-500 ml-1 font-bold">From</Label>
                                <DatePicker 
                                    date={startDate} 
                                    setDate={setStartDate} 
                                    className="w-full sm:w-[150px] min-h-[40px] shadow-sm bg-white dark:bg-zinc-950" 
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 flex-1 sm:flex-initial">
                                <Label className="text-[10px] uppercase text-zinc-500 ml-1 font-bold">To</Label>
                                <DatePicker 
                                    date={endDate} 
                                    setDate={setEndDate} 
                                    className="w-full sm:w-[150px] min-h-[40px] shadow-sm bg-white dark:bg-zinc-950" 
                                />
                            </div>
                        </div>

                    </div>
                </div>

                {/* ALERTS SECTION MOVED TO TOP */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mt-2">
                    {/* UNSETTLED DELIVERIES */}
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-4 sm:p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-4 sm:mb-6">
                                <h2 className="text-[11px] sm:text-sm font-bold text-orange-600 dark:text-orange-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                    Unsettled Deliveries
                                </h2>
                                <span className="text-xs font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">
                                    {unsettledDeliveries.total_count}
                                </span>
                            </div>

                            <div className="flex flex-col gap-2 sm:gap-3 max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {unsettledDeliveries.items.length === 0 ? (
                                    <p className="text-sm text-zinc-500 italic">All deliveries have been fully settled! 🎉</p>
                                ) : (
                                    unsettledDeliveries.items.map(order => (
                                        <Link key={order.id} href={`/sales/${order.id}`} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 rounded-xl flex justify-between items-center group hover:border-orange-500 transition-colors">
                                            <div className="flex flex-col truncate pr-2">
                                                <span className="font-bold text-xs sm:text-sm text-black dark:text-white truncate">#{order.id} • {order.customer_name}</span>
                                                <span className="text-[10px] sm:text-xs text-zinc-500 truncate">Delivered via: {order.courier_name}</span>
                                            </div>
                                            <div className="flex flex-col items-end shrink-0">
                                                <span className="font-black text-orange-600 dark:text-orange-500 text-sm sm:text-base leading-none">{Math.round(Number(order.balance)).toLocaleString()}</span>
                                                <span className="text-[9px] sm:text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">Owed (MMK)</span>
                                            </div>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>

                        {unsettledDeliveries.total_count > 3 && (
                            <Link href="/sales?status=delivered&settlement_status=unpaid" className="mt-4 text-center text-[10px] sm:text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline uppercase tracking-wider block">
                                See All {unsettledDeliveries.total_count} Unsettled Deliveries →
                            </Link>
                        )}
                    </div>

                    {/* LOW STOCK ALERTS */}
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-4 sm:p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-4 sm:mb-6">
                            <h2 className="text-[11px] sm:text-sm font-bold text-red-600 dark:text-red-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                Low Stock Alerts
                            </h2>
                            <span className="text-xs font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">
                                {lowStockProducts.total_count}
                            </span>
                        </div>

                        <div className="flex flex-col gap-2 sm:gap-3 max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {lowStockProducts.total_count === 0 ? (
                                <p className="text-sm text-zinc-500 italic">Inventory looks healthy! No low stock alerts.</p>
                            ) : (
                                lowStockProducts.items.map(product => (
                                    <Link key={product.id} href={`/inventory/${product.id}`} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4 rounded-xl flex justify-between items-center group hover:border-red-500 transition-colors">
                                        <div className="flex flex-col truncate pr-2">
                                            <span className="font-bold text-xs sm:text-sm text-black dark:text-white flex flex-wrap items-center gap-1.5 truncate">
                                                <span className="truncate">{product.name}</span>
                                                {product.pending_stock > 0 && (
                                                    <span className="text-[9px] sm:text-[10px] text-black dark:text-white font-black tracking-wide uppercase bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded whitespace-nowrap">
                                                        +{product.pending_stock} Arriving
                                                    </span>
                                                )}
                                            </span>
                                            <span className="text-[10px] sm:text-xs text-zinc-500">Retail: {Math.round(Number(product.retail_price)).toLocaleString()} MMK</span>
                                        </div>
                                        <div className="flex flex-col items-end bg-red-50 dark:bg-red-900/20 px-2 sm:px-3 py-1 rounded-lg border border-red-100 dark:border-red-900/50 shrink-0">
                                            <span className="font-black text-red-600 dark:text-red-500 text-sm sm:text-lg leading-none">{product.stock_quantity}</span>
                                            <span className="text-[9px] sm:text-[10px] font-bold text-red-400 uppercase tracking-widest mt-0.5">Left</span>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>

                        {lowStockProducts.total_count > 3 && (
                            <Link href="/inventory?filter=low_stock" className="mt-4 text-center text-[10px] sm:text-xs font-bold text-red-600 dark:text-red-400 hover:underline uppercase tracking-wider block">
                                See All {lowStockProducts.total_count} Low Stock Items →
                            </Link>
                        )}
                    </div>
                </div>

                {/* METRICS GRID - COMPACT ON MOBILE */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-2">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[96px] sm:h-36 transition-all hover:border-black dark:hover:border-white group">
                        <h3 className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-tight">Net Revenue</h3>
                        <div className="mt-2 sm:mt-0">
                            <p className="text-lg sm:text-2xl font-black text-black dark:text-white group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                {Math.round(Number(metrics.net_revenue)).toLocaleString()}
                            </p>
                            <p className="text-[9px] sm:text-xs text-zinc-400 font-bold mt-0.5">MMK</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[96px] sm:h-36 transition-all hover:border-black dark:hover:border-white group">
                        <h3 className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-tight">Gross Profit</h3>
                        <div className="mt-2 sm:mt-0">
                            <p className="text-lg sm:text-2xl font-black text-black dark:text-white group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                {Math.round(Number(metrics.gross_profit || 0)).toLocaleString()}
                            </p>
                            <p className="text-[9px] sm:text-xs text-zinc-400 font-bold mt-0.5">MMK (Before Expenses)</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[96px] sm:h-36 transition-all hover:border-red-500 group relative overflow-hidden">
                        <h3 className="text-[9px] sm:text-[10px] font-bold text-red-600 dark:text-red-500 uppercase tracking-widest relative z-10 leading-tight">Total Expenses</h3>
                        <div className="relative z-10 mt-2 sm:mt-0">
                            <p className="text-lg sm:text-2xl font-black text-red-600 dark:text-red-400 group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                -{Math.round(Number(metrics.total_expenses || 0)).toLocaleString()}
                            </p>
                            <p className="text-[9px] sm:text-xs text-red-600/50 dark:text-red-500/50 font-bold mt-0.5">MMK</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-900/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[96px] sm:h-36 transition-all hover:border-green-500 group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-10 text-green-500 dark:text-green-400">
                            <svg className="w-8 h-8 sm:w-12 sm:h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                        </div>
                        <h3 className="text-[9px] sm:text-[10px] font-bold text-green-600 dark:text-green-500 uppercase tracking-widest relative z-10 leading-tight">Net Profit</h3>
                        <div className="relative z-10 mt-2 sm:mt-0">
                            <p className="text-lg sm:text-2xl font-black text-green-600 dark:text-green-400 group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                {Math.round(Number(metrics.net_profit)).toLocaleString()}
                            </p>
                            <p className="text-[9px] sm:text-xs text-green-600/50 dark:text-green-500/50 font-bold mt-0.5">MMK (After Expenses)</p>
                        </div>
                    </div>

                    <Link href="/sales?status=pending" className="bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-900/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[96px] sm:h-36 transition-all hover:border-blue-500 group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-10 text-blue-500 dark:text-blue-400">
                            <svg className="w-8 h-8 sm:w-12 sm:h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-[9px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-500 uppercase tracking-widest relative z-10 leading-tight">Needs Delivery</h3>
                        <div className="relative z-10 mt-2 sm:mt-0">
                            <p className="text-lg sm:text-2xl font-black text-blue-600 dark:text-blue-400 group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                {Number(metrics.pending_orders_count || 0)}
                            </p>
                            <p className="text-[9px] sm:text-xs text-blue-600/50 dark:text-blue-500/50 font-bold mt-0.5">Pending Orders</p>
                        </div>
                    </Link>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[96px] sm:h-36 transition-all hover:border-black dark:hover:border-white group">
                        <h3 className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-tight">Inventory Cost</h3>
                        <div className="mt-2 sm:mt-0">
                            <p className="text-lg sm:text-2xl font-black text-black dark:text-white group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                {Math.round(Number(metrics.inventory_cost)).toLocaleString()}
                            </p>
                            <p className="text-[9px] sm:text-xs text-zinc-400 font-bold mt-0.5 truncate">Total Base Cost (MMK)</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[96px] sm:h-36 transition-all hover:border-black dark:hover:border-white group">
                        <h3 className="text-[9px] sm:text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-tight">Expected Retail</h3>
                        <div className="mt-2 sm:mt-0">
                            <p className="text-lg sm:text-2xl font-black text-black dark:text-white group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                {Math.round(Number(metrics.inventory_retail)).toLocaleString()}
                            </p>
                            <p className="text-[9px] sm:text-xs text-zinc-400 font-bold mt-0.5 truncate">Total Retail Value (MMK)</p>
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout >
    );
}
