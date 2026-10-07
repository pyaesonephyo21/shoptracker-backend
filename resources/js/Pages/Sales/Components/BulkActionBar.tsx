import React from 'react';
import { SalesOrder } from '@/types/sales';
import { Button } from '@/components/ui/button';
import { Truck, CheckCircle2, DollarSign, X, AlertCircle } from 'lucide-react';

interface BulkActionBarProps {
    selectedOrders: SalesOrder[];
    onClearSelection: () => void;
    onOpenFulfill: () => void;
    onOpenDeliver: () => void;
    onOpenSettle: () => void;
}

export default function BulkActionBar({
    selectedOrders,
    onClearSelection,
    onOpenFulfill,
    onOpenDeliver,
    onOpenSettle,
}: BulkActionBarProps) {
    if (selectedOrders.length === 0) return null;

    const count = selectedOrders.length;
    const statuses = Array.from(new Set(selectedOrders.map((o) => o.status)));

    // Determine viable actions
    const allPendingOrDeliveryAdded = statuses.length > 0 && statuses.every((s) => s === 'pending' || s === 'delivery_added');
    const allDeliveryAdded = statuses.length === 1 && statuses[0] === 'delivery_added';
    const allDelivered = statuses.length === 1 && statuses[0] === 'delivered';
    const isMixedIncompatible = !allPendingOrDeliveryAdded && !allDelivered;

    return (
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-3 right-3 sm:left-auto sm:right-5 sm:bottom-5 sm:max-w-lg z-45 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3">
            <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl p-2.5 sm:p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-2">
                    <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
                        <span className="text-xs font-black text-black dark:text-white uppercase tracking-wider">
                            {count} COD Selected
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={onClearSelection}
                        className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-black dark:hover:text-white flex items-center gap-1 transition-colors rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                        <X className="w-3 h-3" />
                        <span>Clear</span>
                    </button>
                </div>

                {isMixedIncompatible ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-lg border border-amber-200 dark:border-amber-900">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Select orders of the same stage (Pending, Deli Added, or Delivered).</span>
                    </div>
                ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                        {allPendingOrDeliveryAdded && (
                            <Button
                                type="button"
                                onClick={onOpenFulfill}
                                className="flex-1 h-9 min-h-[36px] text-[11px] font-bold uppercase tracking-wider bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200 shadow-sm"
                            >
                                <Truck className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                {allDeliveryAdded ? 'Change Courier' : 'Add Delivery'}
                            </Button>
                        )}

                        {allDeliveryAdded && (
                            <Button
                                type="button"
                                onClick={onOpenDeliver}
                                className="flex-1 h-9 min-h-[36px] text-[11px] font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                Mark Delivered
                            </Button>
                        )}

                        {allDelivered && (
                            <Button
                                type="button"
                                onClick={onOpenSettle}
                                className="flex-1 h-9 min-h-[36px] text-[11px] font-bold uppercase tracking-wider bg-orange-600 hover:bg-orange-700 text-white shadow-sm"
                            >
                                <DollarSign className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                                Settle COD
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
