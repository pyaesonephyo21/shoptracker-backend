import React, { useState, useEffect, useRef } from 'react';
import AppLayout from '../Layouts/AppLayout';
import { Head, router, Link } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DashboardProps {
    filters: {
        start_date: string;
        end_date: string;
        revenue_status: string;
    };
    cashFlow: {
        items: {
            method: string;
            amount: number;
        }[];
        total: number;
    };
    metrics: {
        total_expenses: number;
        gross_profit: number;
        net_revenue: number;
        net_profit: number;
        inventory_cost: number;
        inventory_retail: number;
    };
    alerts: {
        pending_orders: { total_count: number; total_value: number; };
        delivery_added: { total_count: number; total_value: number; };
        unsettled_deliveries: { total_count: number; total_value: number; };
        low_stock: { total_count: number; };
    };
}

const statusLabels: Record<string, string> = {
    'completed': 'Completed Only',
    'delivered': 'Delivered & Completed',
    'all': 'All Active Orders'
};

export default function Dashboard({ filters, metrics, alerts, cashFlow }: DashboardProps) {
    const [startDate, setStartDate] = useState<Date | undefined>(filters.start_date ? new Date(filters.start_date) : undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(filters.end_date ? new Date(filters.end_date) : undefined);
    const [revenueStatus, setRevenueStatus] = useState<string>(filters.revenue_status || 'completed');
    const [activeTab, setActiveTab] = useState<'financials' | 'alerts'>('financials');

    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        router.get('/', { 
            start_date: startDate ? startDate.toISOString().split('T')[0] : undefined, 
            end_date: endDate ? endDate.toISOString().split('T')[0] : undefined,
            revenue_status: revenueStatus
        }, { preserveState: true, preserveScroll: true });
    }, [startDate, endDate, revenueStatus]);

    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />

            <div className="flex flex-col gap-4 sm:gap-6 pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex flex-col lg:flex-row lg:justify-between lg:items-end gap-3">
                    <div>
                        <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">
                            Overview
                        </h1>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 bg-zinc-50 dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full lg:w-auto">

                        <div className="grid grid-cols-2 lg:flex w-full lg:w-auto gap-2">
                            <div className="flex flex-col gap-1 w-full lg:flex-initial">
                                <Label className="text-[9px] uppercase text-zinc-500 ml-1 font-bold">From</Label>
                                <DatePicker 
                                    date={startDate} 
                                    setDate={setStartDate} 
                                    className="w-full lg:w-[150px] h-8 shadow-sm bg-white dark:bg-zinc-950 text-xs" 
                                />
                            </div>
                            <div className="flex flex-col gap-1 w-full lg:flex-initial">
                                <Label className="text-[9px] uppercase text-zinc-500 ml-1 font-bold">To</Label>
                                <DatePicker 
                                    date={endDate} 
                                    setDate={setEndDate} 
                                    className="w-full lg:w-[150px] h-8 shadow-sm bg-white dark:bg-zinc-950 text-xs" 
                                />
                            </div>
                            <div className="flex flex-col gap-1 col-span-2 lg:flex-initial mt-1 lg:mt-0">
                                <Label className="text-[9px] uppercase text-zinc-500 ml-1 font-bold">Revenue Status</Label>
                                <Select value={revenueStatus} onValueChange={(val) => setRevenueStatus(val || 'completed')}>
                                    <SelectTrigger className="w-full lg:w-[180px] h-8 shadow-sm bg-white dark:bg-zinc-950 text-xs truncate">
                                        {statusLabels[revenueStatus] || "Select Status"}
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="completed">Completed Only</SelectItem>
                                        <SelectItem value="delivered">Delivered & Completed</SelectItem>
                                        <SelectItem value="all">All Active Orders</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                    </div>
                </div>

                {/* TAB SWITCHER */}
                <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl w-full lg:w-fit mb-1 border border-zinc-200 dark:border-zinc-800">
                    <button
                        onClick={() => setActiveTab('financials')}
                        className={`flex-1 lg:px-12 py-2 rounded-lg text-[11px] font-bold transition-all uppercase tracking-widest ${activeTab === 'financials' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        Financials
                    </button>
                    <button
                        onClick={() => setActiveTab('alerts')}
                        className={`flex-1 lg:px-12 py-2 rounded-lg text-[11px] font-bold transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${activeTab === 'alerts' ? 'bg-white dark:bg-zinc-800 text-black dark:text-white shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                    >
                        Alerts
                        {(alerts.unsettled_deliveries.total_count + alerts.pending_orders.total_count + alerts.delivery_added.total_count) > 0 && (
                            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-md leading-none animate-pulse">
                                {alerts.unsettled_deliveries.total_count + alerts.pending_orders.total_count + alerts.delivery_added.total_count}
                            </span>
                        )}
                    </button>
                </div>

                {activeTab === 'alerts' && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-2">
                        <Link href="/sales?status=pending" prefetch={['mount', 'hover']} cacheFor="1m" className="bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-900/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[96px] sm:h-36 transition-all hover:border-blue-500 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-10 text-blue-500 dark:text-blue-400">
                                <svg className="w-8 h-8 sm:w-12 sm:h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <h3 className="text-[9px] sm:text-[10px] font-bold text-blue-600 dark:text-blue-500 uppercase tracking-widest relative z-10 leading-tight">Needs Delivery</h3>
                            <div className="relative z-10 mt-2 sm:mt-0">
                                <p className="text-lg sm:text-2xl font-black text-blue-600 dark:text-blue-400 group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                    {Number(alerts.pending_orders.total_count)}
                                </p>
                                <p className="text-[9px] sm:text-xs text-blue-600/50 dark:text-blue-500/50 font-bold mt-0.5 truncate">{Math.round(alerts.pending_orders.total_value).toLocaleString()} MMK</p>
                            </div>
                        </Link>

                        <Link href="/sales?status=delivery_added" prefetch={['mount', 'hover']} cacheFor="1m" className="bg-white dark:bg-zinc-900 border border-purple-200 dark:border-purple-900/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[96px] sm:h-36 transition-all hover:border-purple-500 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-10 text-purple-500 dark:text-purple-400">
                                <svg className="w-8 h-8 sm:w-12 sm:h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <h3 className="text-[9px] sm:text-[10px] font-bold text-purple-600 dark:text-purple-500 uppercase tracking-widest relative z-10 leading-tight">In Transit</h3>
                            <div className="relative z-10 mt-2 sm:mt-0">
                                <p className="text-lg sm:text-2xl font-black text-purple-600 dark:text-purple-400 group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                    {Number(alerts.delivery_added.total_count)}
                                </p>
                                <p className="text-[9px] sm:text-xs text-purple-600/50 dark:text-purple-500/50 font-bold mt-0.5 truncate">{Math.round(alerts.delivery_added.total_value).toLocaleString()} MMK</p>
                            </div>
                        </Link>

                        <Link href="/sales?status=delivered&settlement_status=unpaid" prefetch={['mount', 'hover']} cacheFor="1m" className="bg-white dark:bg-zinc-900 border border-orange-200 dark:border-orange-900/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[96px] sm:h-36 transition-all hover:border-orange-500 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-10 text-orange-500 dark:text-orange-400">
                                <svg className="w-8 h-8 sm:w-12 sm:h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <h3 className="text-[9px] sm:text-[10px] font-bold text-orange-600 dark:text-orange-500 uppercase tracking-widest relative z-10 leading-tight">Unsettled Deliveries</h3>
                            <div className="relative z-10 mt-2 sm:mt-0">
                                <p className="text-lg sm:text-2xl font-black text-orange-600 dark:text-orange-400 group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                    {Number(alerts.unsettled_deliveries.total_count)}
                                </p>
                                <p className="text-[9px] sm:text-xs text-orange-600/50 dark:text-orange-500/50 font-bold mt-0.5 truncate">{Math.round(alerts.unsettled_deliveries.total_value).toLocaleString()} MMK Owed</p>
                            </div>
                        </Link>

                        <Link href="/inventory?filter=low_stock" prefetch={['mount', 'hover']} cacheFor="1m" className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between min-h-[96px] sm:h-36 transition-all hover:border-red-500 group relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 sm:p-4 opacity-10 text-red-500 dark:text-red-400">
                                <svg className="w-8 h-8 sm:w-12 sm:h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                            </div>
                            <h3 className="text-[9px] sm:text-[10px] font-bold text-red-600 dark:text-red-500 uppercase tracking-widest relative z-10 leading-tight">Low Stock Alerts</h3>
                            <div className="relative z-10 mt-2 sm:mt-0">
                                <p className="text-lg sm:text-2xl font-black text-red-600 dark:text-red-400 group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                    {Number(alerts.low_stock.total_count)}
                                </p>
                                <p className="text-[9px] sm:text-xs text-red-600/50 dark:text-red-500/50 font-bold mt-0.5 truncate">Items Need Restock</p>
                            </div>
                        </Link>
                    </div>
                )}

                {activeTab === 'financials' && (
                    <>
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

                        {/* CASH FLOW SECTION */}
                        <div className="mt-4 sm:mt-6">
                            <h2 className="text-lg font-black text-black dark:text-white tracking-tight mb-4">Cash Flow Breakdown</h2>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                {cashFlow.items.map((item, idx) => (
                                    <div key={idx} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col justify-between transition-all hover:border-blue-500 group">
                                        <h3 className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest leading-tight">{item.method}</h3>
                                        <div className="mt-2">
                                            <p className="text-base sm:text-xl font-black text-black dark:text-white group-hover:scale-[1.02] transition-transform origin-left leading-tight truncate">
                                                {Math.round(Number(item.amount)).toLocaleString()}
                                            </p>
                                            <p className="text-[9px] text-zinc-400 font-bold mt-0.5">MMK Collected</p>
                                        </div>
                                    </div>
                                ))}
                                {cashFlow.items.length === 0 && (
                                    <div className="col-span-2 lg:col-span-4 p-8 text-center text-sm font-bold text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                                        No payments recorded in this period.
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppLayout >
    );
}
