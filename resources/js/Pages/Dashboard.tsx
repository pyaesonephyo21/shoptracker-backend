import React, { useState } from 'react';
import AppLayout from '../Layouts/AppLayout';
import { Head, router, Link } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface DashboardProps {
    filters: {
        start_date: string;
        end_date: string;
    };
    metrics: {
        net_revenue: number;
        net_profit: number;
        inventory_cost: number;
        inventory_retail: number;
    };
    lowStockProducts: {
        id: number;
        name: string;
        stock_quantity: number;
        retail_price: number;
    }[];
    unsettledDeliveries: {
        id: number;
        date: string;
        customer_name: string;
        courier_name: string;
        balance: number;
    }[];
}

export default function Dashboard({ filters, metrics, lowStockProducts, unsettledDeliveries }: DashboardProps) {
    const [startDate, setStartDate] = useState(filters.start_date);
    const [endDate, setEndDate] = useState(filters.end_date);

    const applyFilter = () => {
        router.get('/', { start_date: startDate, end_date: endDate }, { preserveState: true });
    };

    return (
        <AppLayout title="Dashboard">
            <Head title="Dashboard" />

            <div className="flex flex-col gap-8 pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                            Overview.
                        </h1>
                        <p className="text-sm font-medium text-zinc-500 mt-1">Financial & operations summary</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end gap-3 bg-zinc-50 dark:bg-zinc-900 p-2 sm:p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full md:w-auto">

                        <div className="flex w-full sm:w-auto gap-3">
                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                <Label className="text-[10px] uppercase text-zinc-500 ml-1 font-bold">From</Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="appearance-none block h-10 text-sm w-full bg-white dark:bg-zinc-950 shadow-sm px-2 min-w-0"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                                <Label className="text-[10px] uppercase text-zinc-500 ml-1 font-bold">To</Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="appearance-none block h-10 text-sm w-full bg-white dark:bg-zinc-950 shadow-sm px-2 min-w-0"
                                />
                            </div>
                        </div>

                        <Button onClick={applyFilter} className="w-full sm:w-auto h-10 px-4 sm:px-6 text-xs font-bold shadow-md shrink-0">
                            APPLY
                        </Button>
                    </div>
                </div>

                {/* METRICS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36 transition-all hover:border-black dark:hover:border-white group">
                        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Net Revenue</h3>
                        <div>
                            <p className="text-2xl font-black text-black dark:text-white group-hover:scale-[1.02] transition-transform origin-left">
                                {Number(metrics.net_revenue).toLocaleString()}
                            </p>
                            <p className="text-xs text-zinc-400 font-bold">MMK</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-green-200 dark:border-green-900/50 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36 transition-all hover:border-green-500 group relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10 text-green-500 dark:text-green-400">
                            <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                        </div>
                        <h3 className="text-[10px] font-bold text-green-600 dark:text-green-500 uppercase tracking-widest">Net Profit</h3>
                        <div>
                            <p className="text-2xl font-black text-green-600 dark:text-green-400 group-hover:scale-[1.02] transition-transform origin-left">
                                {Number(metrics.net_profit).toLocaleString()}
                            </p>
                            <p className="text-xs text-green-600/50 dark:text-green-500/50 font-bold">MMK</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36 transition-all hover:border-black dark:hover:border-white group">
                        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Inventory Cost</h3>
                        <div>
                            <p className="text-2xl font-black text-black dark:text-white group-hover:scale-[1.02] transition-transform origin-left">
                                {Number(metrics.inventory_cost).toLocaleString()}
                            </p>
                            <p className="text-xs text-zinc-400 font-bold">Total Base Cost (MMK)</p>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-36 transition-all hover:border-black dark:hover:border-white group">
                        <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Expected Retail Value</h3>
                        <div>
                            <p className="text-2xl font-black text-black dark:text-white group-hover:scale-[1.02] transition-transform origin-left">
                                {Number(metrics.inventory_retail).toLocaleString()}
                            </p>
                            <p className="text-xs text-zinc-400 font-bold">Total Retail Value (MMK)</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-4">
                    {/* UNSETTLED DELIVERIES */}
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-sm font-bold text-orange-600 dark:text-orange-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
                                Unsettled Deliveries
                            </h2>
                            <span className="text-xs font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">
                                {unsettledDeliveries.length}
                            </span>
                        </div>

                        <div className="flex flex-col gap-3">
                            {unsettledDeliveries.length === 0 ? (
                                <p className="text-sm text-zinc-500 italic">All deliveries have been fully settled! 🎉</p>
                            ) : (
                                unsettledDeliveries.map(order => (
                                    <Link key={order.id} href={`/sales/${order.id}`} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex justify-between items-center group hover:border-orange-500 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-black dark:text-white">#{order.id} • {order.customer_name}</span>
                                            <span className="text-xs text-zinc-500">Delivered via: {order.courier_name}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-orange-600 dark:text-orange-500 text-base">{Number(order.balance).toLocaleString()}</span>
                                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Owed (MMK)</span>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>

                    {/* LOW STOCK ALERTS */}
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-sm font-bold text-red-600 dark:text-red-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                Low Stock Alerts
                            </h2>
                            <span className="text-xs font-bold text-zinc-400 bg-zinc-200 dark:bg-zinc-800 px-2 py-1 rounded">
                                {lowStockProducts.length}
                            </span>
                        </div>

                        <div className="flex flex-col gap-3">
                            {lowStockProducts.length === 0 ? (
                                <p className="text-sm text-zinc-500 italic">Inventory looks healthy! No low stock alerts.</p>
                            ) : (
                                lowStockProducts.map(product => (
                                    <Link key={product.id} href={`/inventory/${product.id}`} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex justify-between items-center group hover:border-red-500 transition-colors">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-sm text-black dark:text-white">{product.name}</span>
                                            <span className="text-xs text-zinc-500">Retail: {Number(product.retail_price).toLocaleString()} MMK</span>
                                        </div>
                                        <div className="flex flex-col items-end bg-red-50 dark:bg-red-900/20 px-3 py-1 rounded-lg border border-red-100 dark:border-red-900/50">
                                            <span className="font-black text-red-600 dark:text-red-500 text-lg">{product.stock_quantity}</span>
                                            <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Left</span>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout >
    );
}
