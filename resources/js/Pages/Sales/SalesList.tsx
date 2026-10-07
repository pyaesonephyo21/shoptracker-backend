import React, { useState, useEffect } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { CourierOption, PaymentMethodOption, SalesOrder } from '@/types/sales';
import { PaginatedData } from '@/types/pagination';
import Pagination from '@/components/Pagination';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Filter, Check, Lock, MapPin } from 'lucide-react';
import { useRevalidateOnBack } from '@/hooks/useRevalidateOnBack';
import BulkFulfillCodModal from './Components/BulkFulfillCodModal';
import BulkDeliverCodDialog from './Components/BulkDeliverCodDialog';
import BulkActionBar from './Components/BulkActionBar';

interface SalesListFilters {
    status?: string;
    settlement_status?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
    payment_method?: string;
}

interface SalesListProps {
    orders: PaginatedData<SalesOrder>;
    couriers?: CourierOption[];
    payment_methods?: PaymentMethodOption[];
    filters?: SalesListFilters;
}

export default function SalesList({
    orders,
    couriers = [],
    payment_methods: propPaymentMethods,
    filters = { status: '', settlement_status: '', search: '', start_date: '', end_date: '' },
}: SalesListProps) {
    const pageAuth = usePage<{ auth?: { payment_methods?: PaymentMethodOption[] } }>().props;
    const availablePaymentMethods = propPaymentMethods || pageAuth.auth?.payment_methods || [];

    const [searchVal, setSearchVal] = useState(filters.search || '');
    const [activeStatus, setActiveStatus] = useState(filters.status || '');
    const [activeSettlement, setActiveSettlement] = useState(filters.settlement_status || '');
    const [activePaymentMethod, setActivePaymentMethod] = useState(filters.payment_method || '');
    const [startDate, setStartDate] = useState<Date | undefined>(filters.start_date ? new Date(filters.start_date) : undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(filters.end_date ? new Date(filters.end_date) : undefined);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Bulk action states (COD only)
    const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [isFulfillModalOpen, setIsFulfillModalOpen] = useState(false);
    const [isDeliverDialogOpen, setIsDeliverDialogOpen] = useState(false);

    const hasActiveFilters = Boolean(
        filters.status ||
        filters.settlement_status ||
        filters.payment_method ||
        filters.start_date ||
        filters.end_date
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchVal !== (filters.search || '')) {
                handleFilterChange(activeStatus, searchVal, activeSettlement, activePaymentMethod, startDate, endDate);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchVal]);

    useRevalidateOnBack(['orders']);

    const handleFilterChange = (status: string, search: string, settlement: string, method: string, start?: Date, end?: Date) => {
        setSelectedOrderIds([]);
        router.get(
            '/sales',
            {
                status: status || undefined,
                search: search || undefined,
                settlement_status: settlement || undefined,
                payment_method: method || undefined,
                start_date: start ? start.toISOString().split('T')[0] : undefined,
                end_date: end ? end.toISOString().split('T')[0] : undefined,
                page: 1,
            },
            { preserveState: true, replace: true }
        );
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleFilterChange(activeStatus, searchVal, activeSettlement, activePaymentMethod, startDate, endDate);
    };

    const applyFilters = () => {
        handleFilterChange(activeStatus, searchVal, activeSettlement, activePaymentMethod, startDate, endDate);
        setIsFilterOpen(false);
    };

    const clearFilters = () => {
        setActiveStatus('');
        setActiveSettlement('');
        setActivePaymentMethod('');
        setStartDate(undefined);
        setEndDate(undefined);
        handleFilterChange('', searchVal, '', '', undefined, undefined);
        setIsFilterOpen(false);
    };

    // Stage-specific COD collections on current page (Pending & Delivery Added)
    const pendingCodOrders = orders.data.filter((o) => Boolean(o.is_cod && o.status === 'pending'));
    const deliveryAddedCodOrders = orders.data.filter((o) => Boolean(o.is_cod && o.status === 'delivery_added'));

    const selectedOrders = orders.data.filter((order) => selectedOrderIds.includes(order.id));

    const allPendingSelected =
        pendingCodOrders.length > 0 &&
        pendingCodOrders.every((o) => selectedOrderIds.includes(o.id)) &&
        selectedOrders.every((o) => o.status === 'pending');

    const allDeliveryAddedSelected =
        deliveryAddedCodOrders.length > 0 &&
        deliveryAddedCodOrders.every((o) => selectedOrderIds.includes(o.id)) &&
        selectedOrders.every((o) => o.status === 'delivery_added');

    const toggleSelectPending = () => {
        if (allPendingSelected) {
            setSelectedOrderIds([]);
        } else {
            setSelectedOrderIds(pendingCodOrders.map((o) => o.id));
        }
    };

    const toggleSelectDeliveryAdded = () => {
        if (allDeliveryAddedSelected) {
            setSelectedOrderIds([]);
        } else {
            setSelectedOrderIds(deliveryAddedCodOrders.map((o) => o.id));
        }
    };

    const toggleOrderSelection = (id: number) => {
        setSelectedOrderIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const clearSelection = () => {
        setSelectedOrderIds([]);
        setIsSelectMode(false);
    };

    const hasCodOrders = pendingCodOrders.length > 0 || deliveryAddedCodOrders.length > 0;

    const getStatusStyle = (order: SalesOrder) => {
        if (order.status.toUpperCase() === 'CANCELLED') {
            return { color: 'border border-zinc-200 dark:border-zinc-800 text-zinc-500', text: 'CANCELLED' };
        }
        const payStatus = order.financials.payment_status;
        if (payStatus === 'unpaid') return { color: 'border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent', text: 'UNPAID' };
        if (payStatus === 'partial') return { color: 'border border-zinc-400 dark:border-zinc-500 text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-900', text: 'PARTIAL' };
        if (payStatus === 'paid') return { color: 'bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white', text: 'PAID' };
        return { color: 'border border-zinc-200 dark:border-zinc-800 text-zinc-500 bg-transparent', text: payStatus.toUpperCase() };
    };

    const getOrderStatusStyle = (status: string) => {
        const s = status.toUpperCase();
        if (s === 'PENDING') return 'border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent';
        if (s === 'DELIVERY ADDED') return 'border border-zinc-400 dark:border-zinc-500 text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-900';
        if (s === 'DELIVERED') return 'bg-zinc-800 text-white dark:bg-zinc-200 dark:text-black border border-zinc-800 dark:border-zinc-200';
        if (s === 'COMPLETED') return 'bg-black text-white dark:bg-white dark:text-black border border-black dark:border-white';
        if (s === 'CANCELLED') return 'border border-zinc-300 dark:border-zinc-700 text-zinc-500 line-through decoration-zinc-400 bg-transparent';
        return 'border border-zinc-200 dark:border-zinc-800 text-zinc-500 bg-transparent';
    };

    return (
        <AppLayout title="Sales">
            <Head title="Sales" />

            <div className="flex flex-col gap-4 sm:gap-5 pb-24">
                {/* PAGE HEADER */}
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <h1 className="text-xl sm:text-2xl font-black text-black dark:text-white tracking-tight">
                            Sales
                        </h1>

                        {/* Toggle Select Mode button */}
                        {hasCodOrders && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (isSelectMode) {
                                        setSelectedOrderIds([]);
                                    }
                                    setIsSelectMode(!isSelectMode);
                                }}
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all select-none border ${isSelectMode
                                        ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-sm'
                                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-transparent hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                    }`}
                            >
                                {isSelectMode ? 'Done' : 'Select'}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <a
                            href={`/sales/export?${new URLSearchParams(filters as Record<string, string>).toString()}`}
                            className="bg-zinc-100 dark:bg-zinc-800 px-2.5 sm:px-3 py-1 rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-sm flex items-center justify-center shrink-0 h-8"
                            title="Export"
                        >
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-widest whitespace-nowrap">
                                Export
                            </span>
                        </a>
                        <Link
                            href="/sales/create"
                            className="bg-black dark:bg-white px-2.5 sm:px-3 py-1 rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-sm flex items-center justify-center shrink-0 h-8"
                        >
                            <span className="text-[10px] font-bold text-white dark:text-black uppercase tracking-widest whitespace-nowrap">
                                + New
                            </span>
                        </Link>
                    </div>
                </div>

                {/* SEARCH AND FILTERS */}
                <div className="flex items-center gap-2">
                    <form onSubmit={handleSearchSubmit} className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 h-9 sm:h-10 flex items-center transition-all duration-200 focus-within:bg-white dark:focus-within:bg-black focus-within:border-black dark:focus-within:border-white">
                        <input
                            className="flex-1 bg-transparent text-xs sm:text-sm font-medium text-black dark:text-white outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                            placeholder="Search customer, order #..."
                            value={searchVal}
                            onChange={(e) => setSearchVal(e.target.value)}
                        />
                        <button type="submit" className="text-[11px] font-bold uppercase text-zinc-400 hover:text-black dark:hover:text-white px-1.5 py-0.5">
                            Search
                        </button>
                    </form>

                    <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                        <DialogTrigger className={`h-9 sm:h-10 px-3 flex items-center justify-center gap-1.5 rounded-lg transition-colors shrink-0 relative ${hasActiveFilters ? 'bg-black dark:bg-white' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>
                            <Filter className={`w-3.5 h-3.5 ${hasActiveFilters ? 'text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-300'}`} />
                            <span className={`text-[11px] font-bold uppercase tracking-wider hidden sm:block ${hasActiveFilters ? 'text-white dark:text-black' : 'text-zinc-600 dark:text-zinc-300'}`}>
                                Filters
                            </span>
                            {hasActiveFilters && (
                                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm ring-2 ring-white dark:ring-black" />
                            )}
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[420px]">
                            <DialogHeader>
                                <DialogTitle className="font-black text-lg uppercase tracking-wider">Filters</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col gap-4 py-3">
                                {/* Date Range */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Date Range</span>

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
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Status</span>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {[
                                            { key: '', label: 'All' },
                                            { key: 'pending', label: 'Pending' },
                                            { key: 'delivery_added', label: 'Deli Added' },
                                            { key: 'delivered', label: 'Delivered' },
                                            { key: 'completed', label: 'Completed' },
                                            { key: 'cancelled', label: 'Cancelled' },
                                        ].map((item) => {
                                            const active = activeStatus === item.key;
                                            return (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    onClick={() => setActiveStatus(item.key)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all select-none ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Settlement Filter */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Payment Status</span>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {[
                                            { key: '', label: 'All' },
                                            { key: 'unpaid', label: 'Unpaid' },
                                            { key: 'partial', label: 'Partial' },
                                            { key: 'paid', label: 'Paid' },
                                        ].map((item) => {
                                            const active = activeSettlement === item.key;
                                            return (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    onClick={() => setActiveSettlement(item.key)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all select-none ${active ? 'bg-black text-white dark:bg-white dark:text-black' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Payment Method Filter */}
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[11px] font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Payment Method</span>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {[
                                            { key: '', label: 'All' },
                                            ...availablePaymentMethods.map((m) => ({ key: m.code, label: m.name })),
                                        ].map((item) => {
                                            const active = activePaymentMethod === item.key;
                                            return (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    onClick={() => setActivePaymentMethod(item.key)}
                                                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all select-none ${active ? 'bg-black text-white dark:bg-black dark:text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
                                                >
                                                    {item.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                                <Button variant="outline" onClick={clearFilters} className="font-bold uppercase tracking-widest text-[10px] h-8 px-3">
                                    Clear
                                </Button>
                                <Button onClick={applyFilters} className="font-bold uppercase tracking-widest text-[10px] h-8 px-3">
                                    Apply
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* FLOATING STAGE-SPECIFIC COD OPTIONS (Only in Select Mode) */}
                {isSelectMode && (pendingCodOrders.length > 0 || deliveryAddedCodOrders.length > 0) && (
                    <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar animate-in fade-in duration-200">
                        {/* Option 1: Pending */}
                        <button
                            type="button"
                            disabled={pendingCodOrders.length === 0}
                            onClick={toggleSelectPending}
                            className={`h-8 px-3 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all select-none flex items-center gap-2 border shrink-0 whitespace-nowrap ${allPendingSelected
                                    ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-sm'
                                    : pendingCodOrders.length > 0
                                        ? 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                                        : 'opacity-40 cursor-not-allowed border-zinc-200 dark:border-zinc-800 text-zinc-400'
                                }`}
                        >
                            <div className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${allPendingSelected
                                    ? 'bg-white text-black dark:bg-black dark:text-white border-transparent'
                                    : 'border-zinc-300 dark:border-zinc-700 bg-transparent'
                                }`}>
                                {allPendingSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <span className="whitespace-nowrap">Pending ({pendingCodOrders.length})</span>
                        </button>

                        {/* Option 2: Deli Added */}
                        <button
                            type="button"
                            disabled={deliveryAddedCodOrders.length === 0}
                            onClick={toggleSelectDeliveryAdded}
                            className={`h-8 px-3 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all select-none flex items-center gap-2 border shrink-0 whitespace-nowrap ${allDeliveryAddedSelected
                                    ? 'bg-black text-white dark:bg-white dark:text-black border-black dark:border-white shadow-sm'
                                    : deliveryAddedCodOrders.length > 0
                                        ? 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600'
                                        : 'opacity-40 cursor-not-allowed border-zinc-200 dark:border-zinc-800 text-zinc-400'
                                }`}
                        >
                            <div className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${allDeliveryAddedSelected
                                    ? 'bg-white text-black dark:bg-black dark:text-white border-transparent'
                                    : 'border-zinc-300 dark:border-zinc-700 bg-transparent'
                                }`}>
                                {allDeliveryAddedSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <span className="whitespace-nowrap">Deli Added ({deliveryAddedCodOrders.length})</span>
                        </button>
                    </div>
                )}

                {/* ORDERS LIST */}
                <div className="flex flex-col">
                    {orders.data.length === 0 ? (
                        <EmptyState
                            title="No Sales Found"
                            description="There are no sales matching your search or filters."
                            action={
                                <Button variant="outline" onClick={clearFilters} className="text-xs font-bold uppercase tracking-widest">
                                    Clear Filters
                                </Button>
                            }
                        />
                    ) : (
                        orders.data.map((item) => {
                            const isCodActive = Boolean(item.is_cod && ['pending', 'delivery_added'].includes(item.status));
                            const isSelected = selectedOrderIds.includes(item.id);

                            const cardContent = (
                                <div className="flex-1 flex justify-between items-start min-w-0">
                                    {/* Left Column: Customer, Address, Badges */}
                                    <div className="flex-1 min-w-0 pr-3">
                                        <div className="flex flex-col gap-1 mb-1">
                                            <span className="font-bold text-black dark:text-white text-sm sm:text-base truncate group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                                                {item.customer.name || 'Walk-in Customer'}
                                            </span>

                                            {item.customer.address && (
                                                <span
                                                    title={item.customer.address}
                                                    className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate flex items-center gap-1 leading-tight -mt-0.5"
                                                >
                                                    <MapPin className="w-3 h-3 shrink-0 text-zinc-400 dark:text-zinc-500" />
                                                    <span className="truncate">{item.customer.address}</span>
                                                </span>
                                            )}

                                            <div className="flex flex-wrap gap-1.5 items-center mt-0.5">
                                                {item.status.toUpperCase() !== 'CANCELLED' && (
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${getStatusStyle(item).color}`}>
                                                        {getStatusStyle(item).text}
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide whitespace-nowrap ${getOrderStatusStyle(item.status)}`}>
                                                    {item.status.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Amount & ID/Date */}
                                    <div className="flex flex-col items-end shrink-0 pt-0.5">
                                        <div className="flex items-baseline gap-1">
                                            <span className="font-black text-black dark:text-white text-sm sm:text-base">
                                                {Number(item.financials.grand_total).toLocaleString()}
                                            </span>
                                            <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                                                MMK
                                            </span>
                                        </div>
                                        <span className="text-[10px] sm:text-[11px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap mt-1">
                                            #{item.id} • {item.date}
                                        </span>
                                    </div>
                                </div>
                            );

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        if (isSelectMode && isCodActive) {
                                            toggleOrderSelection(item.id);
                                        }
                                    }}
                                    className={`py-3 sm:py-3.5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center transition-colors -mx-2 px-2 sm:-mx-3 sm:px-3 rounded-xl group ${isSelected
                                            ? 'bg-zinc-100/80 dark:bg-zinc-800/60'
                                            : isSelectMode && isCodActive
                                                ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                                                : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40'
                                        }`}
                                >
                                    {/* Checkbox / Lock Column (Only in Select Mode) */}
                                    {isSelectMode && (
                                        <div className="min-w-[36px] min-h-[36px] -ml-1 mr-1.5 flex items-center justify-center shrink-0">
                                            {isCodActive ? (
                                                <div
                                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected
                                                            ? 'bg-black border-black text-white dark:bg-white dark:border-white dark:text-black'
                                                            : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400'
                                                        }`}
                                                >
                                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                </div>
                                            ) : (
                                                <div
                                                    title="Single Edit Only (Non-COD)"
                                                    className="cursor-not-allowed opacity-35"
                                                >
                                                    <Lock className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {isSelectMode ? (
                                        <div className="flex-1 min-w-0 select-none">
                                            {cardContent}
                                        </div>
                                    ) : (
                                        <Link
                                            href={`/sales/${item.id}`}
                                            className="flex-1 min-w-0 block"
                                        >
                                            {cardContent}
                                            </Link>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <Pagination meta={orders} />
            </div>

            {/* FLOATING ACTION BAR FOR SELECTED COD ORDERS */}
            <BulkActionBar
                selectedOrders={selectedOrders}
                onClearSelection={clearSelection}
                onOpenFulfill={() => setIsFulfillModalOpen(true)}
                onOpenDeliver={() => setIsDeliverDialogOpen(true)}
            />

            {/* BULK ACTION MODALS */}
            <BulkFulfillCodModal
                isOpen={isFulfillModalOpen}
                onClose={() => setIsFulfillModalOpen(false)}
                selectedOrderIds={selectedOrderIds}
                couriers={couriers}
                onSuccess={clearSelection}
            />

            <BulkDeliverCodDialog
                isOpen={isDeliverDialogOpen}
                onClose={() => setIsDeliverDialogOpen(false)}
                selectedOrderIds={selectedOrderIds}
                onSuccess={clearSelection}
            />
        </AppLayout>
    );
}
