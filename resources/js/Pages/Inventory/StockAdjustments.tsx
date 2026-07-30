import React, { useState, useEffect, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';
import Pagination from '@/components/Pagination';

export default function StockAdjustments({ adjustments, filters }: any) {
    const [startDate, setStartDate] = useState<Date | undefined>(filters.start_date ? new Date(filters.start_date) : undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(filters.end_date ? new Date(filters.end_date) : undefined);
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        router.get('/inventory/adjustments', {
            start_date: startDate ? format(startDate, 'yyyy-MM-dd') : '',
            end_date: endDate ? format(endDate, 'yyyy-MM-dd') : '',
        }, { preserveState: true, preserveScroll: true });
    }, [startDate, endDate]);

    return (
        <AppLayout title="Stock Adjustments Ledger">
            <Head title="Stock Adjustments" />

            <div className="flex flex-col gap-6 sm:gap-8 pb-20">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <div>
                        <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">
                            Stock Adjustments Ledger
                        </h1>
                        <p className="text-xs text-zinc-500 mt-1">Track shrinkage and inventory adjustments</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm flex flex-col h-full">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto">
                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                                <Label className="text-[9px] uppercase text-zinc-500 ml-1 font-bold">From</Label>
                                <DatePicker
                                    date={startDate}
                                    setDate={setStartDate}
                                    placeholder="Start Date"
                                    className="w-full sm:w-[150px] h-8 shadow-sm bg-white dark:bg-zinc-950 text-xs"
                                />
                            </div>
                            <div className="flex flex-col gap-1 w-full sm:w-auto">
                                <Label className="text-[9px] uppercase text-zinc-500 ml-1 font-bold">To</Label>
                                <DatePicker
                                    date={endDate}
                                    setDate={setEndDate}
                                    placeholder="End Date"
                                    disabled={(date) => startDate ? date < new Date(startDate.setHours(0, 0, 0, 0)) : false}
                                    className="w-full sm:w-[150px] h-8 shadow-sm bg-white dark:bg-zinc-950 text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                <tr>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500">Date</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500">User</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500">Product (Variant)</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500">Reason</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500 text-right">Quantity</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500 text-right">Financial Impact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {adjustments.data.map((adj: any) => (
                                    <tr key={adj.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                                            {new Date(adj.created_at).toLocaleString('en-GB', {
                                                year: 'numeric', month: 'short', day: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 font-medium">
                                            {adj.user?.name || '-'}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 font-bold max-w-[200px] truncate">
                                            {adj.product_variant?.product?.name || '-'}
                                            <span className="text-zinc-500 font-normal ml-1">({adj.product_variant?.sku})</span>
                                        </td>
                                        <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100 max-w-[200px] truncate" title={adj.note}>
                                            {adj.reason}
                                        </td>
                                        <td className={`px-4 py-3 font-black text-right ${adj.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {adj.quantity > 0 ? '+' : ''}{adj.quantity}
                                        </td>
                                        <td className={`px-4 py-3 font-black text-right ${adj.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {adj.quantity > 0 ? '+' : '-'}{Math.round(Number(adj.total_cost)).toLocaleString()} MMK
                                        </td>
                                    </tr>
                                ))}
                                {adjustments.data.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-zinc-400 font-medium">No adjustments found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4">
                        <Pagination meta={adjustments} />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
