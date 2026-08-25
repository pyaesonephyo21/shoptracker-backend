import React, { useState, useEffect } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { PurchaseOrder } from '@/types/inventory';
import { twMerge } from 'tailwind-merge';
import { PaginatedData } from '@/types/pagination';
import Pagination from '@/components/Pagination';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { router } from '@inertiajs/react';
import { useRevalidateOnBack } from '@/hooks/useRevalidateOnBack';

export default function PurchaseOrderList({ orders, filters = { search: '', status: '', payment_status: '', start_date: '', end_date: '' } }: { orders: PaginatedData<PurchaseOrder>, filters: { search: string, status: string, payment_status: string, start_date: string, end_date: string } }) {
    const [searchVal, setSearchVal] = useState(filters.search || '');
    const [activeStatus, setActiveStatus] = useState(filters.status || '');
    const [activePayment, setActivePayment] = useState(filters.payment_status || '');
    const [startDate, setStartDate] = useState<Date | undefined>(filters.start_date ? new Date(filters.start_date) : undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(filters.end_date ? new Date(filters.end_date) : undefined);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const hasActiveFilters = Boolean(
        filters.status ||
        filters.payment_status ||
        filters.start_date ||
        filters.end_date
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            // Only trigger if local search differs from current URL search
            if (searchVal !== (filters.search || '')) {
                handleFilterChange(searchVal, activeStatus, activePayment, startDate, endDate);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchVal]); // Only trigger on searchVal change

    useRevalidateOnBack(['orders']);

    const handleFilterChange = (search: string, status: string, payment: string, start?: Date, end?: Date) => {
        router.get('/inventory/purchase-orders', {
            search: search || undefined,
            status: status || undefined,
            payment_status: payment || undefined,
            start_date: start ? start.toISOString().split('T')[0] : undefined,
            end_date: end ? end.toISOString().split('T')[0] : undefined,
            page: 1
        }, { preserveState: true, replace: true });
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilterChange(searchVal, activeStatus, activePayment, startDate, endDate);
    };

    const applyFilters = () => {
        handleFilterChange(searchVal, activeStatus, activePayment, startDate, endDate);
        setIsFilterOpen(false);
    };

    const clearFilters = () => {
        setActiveStatus('');
        setActivePayment('');
        setStartDate(undefined);
        setEndDate(undefined);
        handleFilterChange(searchVal, '', '', undefined, undefined);
        setIsFilterOpen(false);
    };

    const getOrderStatusStyle = (status: string) => {
        const s = status.toUpperCase();
        if (s === "PENDING") return "border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent";
        if (s === "PARTIALLY_ARRIVED") return "border border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30";
        if (s === "ARRIVED") return "bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white";
        if (s === "CANCELLED") return "border border-zinc-300 dark:border-zinc-700 text-zinc-500 line-through decoration-zinc-400 bg-transparent";
        return "border border-zinc-200 dark:border-zinc-800 text-zinc-500 bg-transparent";
    };

    const getPaymentStatusStyle = (paymentStatus: string) => {
        const payStatus = paymentStatus.toLowerCase();
        if (payStatus === "unpaid") return "border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent";
        if (payStatus === "partial") return "border border-zinc-400 dark:border-zinc-500 text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-900";
        if (payStatus === "paid") return "bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white";
        return "border border-zinc-200 dark:border-zinc-800 text-zinc-500 bg-transparent";
    };

    return (
        <AppLayout title="Purchase Orders">
            <Head title="Purchase Orders" />

            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <Link href="/inventory" className="text-zinc-500 hover:text-black dark:hover:text-white text-xl">←</Link>
                        <h1 className="text-2xl sm:text-3xl font-black text-black dark:text-white tracking-tight">
                            Purchases
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <a
                            href={`/inventory/purchase-orders/export?${new URLSearchParams(filters as any).toString()}`}
                            className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-sm flex items-center justify-center shrink-0"
                        >
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">
                                EXPORT
                            </span>
                        </a>
                        <Link
                            href="/inventory/purchase-orders/create"
                            className="bg-black dark:bg-white px-4 py-2 rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-sm flex items-center justify-center shrink-0"
                        >
                            <span className="text-[10px] font-bold text-white dark:text-black uppercase tracking-widest">
                                + New PO
                            </span>
                        </Link>
                    </div>
                </div>

                {/* SEARCH AND FILTERS */}
                <div className="flex items-center gap-2">
                    <form onSubmit={handleSearchSubmit} className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 h-11 flex items-center transition-all duration-200 focus-within:bg-white dark:focus-within:bg-black focus-within:border-black dark:focus-within:border-white">
                        <input
                            className="flex-1 bg-transparent text-sm font-medium text-black dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                            placeholder="Search by batch name or supplier name..."
                            value={searchVal}
                            onChange={(e) => setSearchVal(e.target.value)}
                        />
                        <button type="submit" className="text-xs font-bold uppercase text-zinc-400 hover:text-black dark:hover:text-white">Search</button>
                    </form>

                    <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <DialogTrigger className={`h-11 px-4 flex items-center justify-center gap-2 rounded-xl transition-colors shrink-0 relative ${hasActiveFilters ? 'bg-black dark:bg-white' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
                            <Filter className={`w-4 h-4 ${hasActiveFilters ? 'text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-300'}`} />
                            <span className={`text-xs font-bold uppercase tracking-widest hidden sm:block ${hasActiveFilters ? 'text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-300'}`}>Filters</span>
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 shadow-sm ring-2 ring-white dark:ring-black" />
                            )}
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle className="font-black text-xl uppercase tracking-widest">Filters</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col gap-6 py-4">
                                {/* Date Range */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Date Range</span>
                                    <div className="grid grid-cols-2 gap-2 w-full [&_button]:w-full">
                                        <DatePicker
                                            date={startDate}
                                            setDate={setStartDate}
                                            placeholder="Start Date"
                                        />
                                        <DatePicker
                                            date={endDate}
                                            setDate={setEndDate}
                                            placeholder="End Date"
                                        />
                                    </div>
                                </div>

                                {/* Status Filter */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Status</span>
                                    <div className="flex flex-wrap items-center gap-2">
                                        {[
                                            { key: '', label: 'All' },
                                            { key: 'pending', label: 'Pending' },
                                            { key: 'partially_arrived', label: 'Partially Arrived' },
                                            { key: 'arrived', label: 'Arrived' },
                                            { key: 'cancelled', label: 'Cancelled' }
                                        ].map(item => {
                                            const active = activeStatus === item.key;
                                            return (
                                                <button
                                                    key={item.key}
                                                    onClick={() => setActiveStatus(item.key)}
                                                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all select-none ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Payment Status Filter */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Payment Status</span>
                                    <div className="flex flex-wrap items-center gap-2">
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
                                                    onClick={() => setActivePayment(item.key)}
                                                    className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase transition-all select-none ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                <Button variant="outline" onClick={clearFilters} className="font-bold uppercase tracking-widest text-[10px]">Clear</Button>
                                <Button onClick={applyFilters} className="font-bold uppercase tracking-widest text-[10px]">Apply Filters</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="flex flex-col">
                    {orders.data.length === 0 ? (
                        <EmptyState 
                            title="No Purchase Orders Found" 
                            description="There are no purchase orders matching your search or filters." 
                            action={
                                <Button variant="outline" onClick={clearFilters} className="text-xs font-bold uppercase tracking-widest">
                                    Clear Filters
                                </Button>
                            }
                        />
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
