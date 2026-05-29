import React, { useState, useEffect } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { PurchaseOrder } from '@/types/inventory';
import { twMerge } from 'tailwind-merge';
import { PaginatedData } from '@/types/pagination';
import Pagination from '@/components/Pagination';

import { router } from '@inertiajs/react';

export default function PurchaseOrderList({ orders, filters = { search: '', status: '', payment_status: '' } }: { orders: PaginatedData<PurchaseOrder>, filters: { search: string, status: string, payment_status: string } }) {
    const [searchVal, setSearchVal] = useState(filters.search || '');
    const [activeStatus, setActiveStatus] = useState(filters.status || '');
    const [activePayment, setActivePayment] = useState(filters.payment_status || '');

    useEffect(() => {
        const timer = setTimeout(() => {
            // Only trigger if local search differs from current URL search
            if (searchVal !== (filters.search || '')) {
                handleFilterChange(searchVal, activeStatus, activePayment);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchVal]); // Only trigger on searchVal change

    const handleFilterChange = (search: string, status: string, payment: string) => {
        router.get('/inventory/purchase-orders', {
            search: search || undefined,
            status: status || undefined,
            payment_status: payment || undefined
        }, { preserveState: true, replace: true });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilterChange(searchVal, activeStatus, activePayment);
    };

    const getOrderStatusStyle = (status: string) => {
        const s = status.toUpperCase();
        if (s === "PENDING") return "text-zinc-500 bg-zinc-100 dark:bg-zinc-800";
        if (s === "ARRIVED") return "text-green-600 bg-green-50 dark:bg-green-900/20";
        if (s === "CANCELLED") return "text-red-600 bg-red-50 dark:bg-red-900/20";
        return "text-zinc-500 bg-zinc-100 dark:bg-zinc-800";
    };

    const getPaymentStatusStyle = (paymentStatus: string) => {
        const payStatus = paymentStatus.toLowerCase();
        if (payStatus === "unpaid") return "text-red-500 bg-red-50 dark:bg-red-900/20";
        if (payStatus === "partial") return "text-orange-500 bg-orange-50 dark:bg-orange-900/20";
        if (payStatus === "paid") return "text-green-600 bg-green-50 dark:bg-green-900/20";
        return "text-zinc-500 bg-zinc-100 dark:bg-zinc-800";
    };

    return (
        <AppLayout title="Purchase Orders">
            <Head title="Purchase Orders" />

            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/inventory" className="text-zinc-500 hover:text-black dark:hover:text-white text-xl">←</Link>
                        <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                            Purchases.
                        </h1>
                    </div>

                    <Link
                        href="/inventory/purchase-orders/create"
                        className="bg-black dark:bg-white px-4 py-2 rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-sm"
                    >
                        <span className="text-[10px] font-bold text-white dark:text-black uppercase tracking-widest">
                            + New PO
                        </span>
                    </Link>
                </div>

                {/* SEARCH AND FILTERS */}
                <div className="flex flex-col gap-3">
                    <form onSubmit={handleSearchSubmit} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 h-11 flex items-center transition-all duration-200 focus-within:bg-white dark:focus-within:bg-black focus-within:border-black dark:focus-within:border-white">
                        <input
                            className="flex-1 bg-transparent text-sm font-medium text-black dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                            placeholder="Search by batch name or supplier name..."
                            value={searchVal}
                            onChange={(e) => setSearchVal(e.target.value)}
                        />
                        <button type="submit" className="text-xs font-bold uppercase text-zinc-400 hover:text-black dark:hover:text-white">Search</button>
                    </form>

                    <div className="flex flex-col gap-2">
                        {/* Status Filter */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider select-none shrink-0">Status:</span>
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1 scrollbar-none">
                                {[
                                    { key: '', label: 'All' },
                                    { key: 'pending', label: 'Pending' },
                                    { key: 'arrived', label: 'Arrived' },
                                    { key: 'cancelled', label: 'Cancelled' }
                                ].map(item => {
                                    const active = activeStatus === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => {
                                                const nextStatus = activeStatus === item.key ? '' : item.key;
                                                setActiveStatus(nextStatus);
                                                handleFilterChange(searchVal, nextStatus, activePayment);
                                            }}
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all select-none whitespace-nowrap ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Payment Status Filter */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider select-none shrink-0">Payment:</span>
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1 scrollbar-none">
                                {[
                                    { key: '', label: 'All' },
                                    { key: 'unpaid', label: 'Unpaid' },
                                    { key: 'partial', label: 'Partial' },
                                    { key: 'paid', label: 'Paid' }
                                ].map(item => {
                                    const active = activePayment === item.key;
                                    return (
                                        <button
                                            key={item.key}
                                            onClick={() => {
                                                const nextPayment = activePayment === item.key ? '' : item.key;
                                                setActivePayment(nextPayment);
                                                handleFilterChange(searchVal, activeStatus, nextPayment);
                                            }}
                                            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all select-none whitespace-nowrap ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    {orders.data.length === 0 ? (
                        <div className="mt-10 flex justify-center items-center p-10 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50">
                            <span className="text-zinc-400 font-medium">No purchase orders found.</span>
                        </div>
                    ) : (
                        orders.data.map((item) => {
                            const isArrived = item.status === "arrived";
                            const isPaid = item.payment_status === "paid";

                            return (
                                <Link
                                    key={item.id}
                                    href={`/inventory/purchase-orders/${item.id}`}
                                    className="py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 px-4 -mx-4 rounded-xl group"
                                >
                                    <div>
                                        <div className="flex items-center mb-1 gap-2">
                                            <span className="font-bold text-black dark:text-white text-base mr-2">
                                                {item.batch_name}
                                            </span>
                                            <div className="flex gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getOrderStatusStyle(item.status)}`}>
                                                    {item.status.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                                            {new Date(item.created_at).toLocaleDateString()} • {item.supplier_name || "Unknown Supplier"}
                                        </span>
                                    </div>

                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-sm font-bold text-black dark:text-white">
                                            {Number(item.grand_total).toLocaleString()} MMK
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getPaymentStatusStyle(item.payment_status)}`}>
                                            {item.payment_status}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
                
                <Pagination meta={orders} />
            </div>
        </AppLayout>
    );
}
