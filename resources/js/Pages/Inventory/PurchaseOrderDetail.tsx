import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { PurchaseOrder } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { twMerge } from 'tailwind-merge';
const formatLogValue = (val: any) => {
    if (val === null || val === undefined || val === '') return 'none';
    if (typeof val === 'number') return val.toLocaleString();
    if (typeof val === 'string') {
        if (/^(0|[1-9]\d*)(\.\d+)?$/.test(val)) {
            return Number(val).toLocaleString();
        }
        return val;
    }
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

export default function PurchaseOrderDetail({ order }: { order: PurchaseOrder }) {
    const isArrived = order.status === 'arrived';
    const isCancelled = order.status === 'cancelled';
    const isPending = order.status === 'pending';
    const [isReceivingMode, setIsReceivingMode] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState("");

    const { data, setData, post, processing } = useForm({
        cargo_fee: '',
        local_deli_fee: '',
        adjustment_amount: '',
        adjustment_reason: '',
        received_items: order.items?.map(item => {
            const rp = item.retail_price || item.product?.retail_price;
            return {
                id: item.id,
                received_quantity: item.quantity.toString(),
                retail_price: (rp === 0 || !rp) ? '' : rp.toString()
            };
        }) || []
    });

    const formatMMK = (val: number) => Number(val).toLocaleString();

    const CostRow = ({ label, value, isTotal = false }: { label: string, value: number, isTotal?: boolean }) => (
        <div className={twMerge("flex justify-between items-center mb-2", isTotal ? "mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700" : "")}>
            <span className={twMerge("text-xs", isTotal ? "font-black text-black dark:text-white" : "font-medium text-zinc-500")}>{label}</span>
            <span className={twMerge("text-xs", isTotal ? "font-black text-black dark:text-white text-base" : "font-bold text-zinc-800 dark:text-zinc-300")}>
                {value !== 0 && value !== null && value !== undefined ? formatMMK(value) : "-"}
            </span>
        </div>
    );

    const handleConfirmArrive = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/inventory/purchase-orders/${order.id}/arrive`, {
            onSuccess: () => setIsReceivingMode(false),
            onError: () => alert('Failed to process arrival')
        });
    };

    const handleCancel = () => {
        router.post(`/inventory/purchase-orders/${order.id}/cancel`, { cancel_reason: cancelReason }, {
            onSuccess: () => {
                setShowCancelModal(false);
                setCancelReason("");
            }
        });
    };

    return (
        <AppLayout title={order.batch_name}>
            <Head title={`PO: ${order.batch_name}`} />

            <div className="flex flex-col max-w-4xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.visit('/inventory/purchase-orders')} type="button" className="text-zinc-500 hover:text-black dark:hover:text-white text-xl">←</button>
                        <div>
                            <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">{order.batch_name}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={twMerge("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded",
                                    isArrived ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500" :
                                        isCancelled ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-500" :
                                            "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400")}>
                                    {order.status}
                                </span>
                                <span className="text-xs text-zinc-400 font-medium">
                                    {new Date(order.created_at).toLocaleDateString()} • {order.supplier_name || 'Local Shop'}
                                </span>
                            </div>
                            {isCancelled && order.cancel_reason && (
                                <p className="text-sm font-bold text-red-600 dark:text-red-400 mt-2">
                                    Cancel Reason: {order.cancel_reason}
                                </p>
                            )}
                        </div>
                    </div>
                    {order.status === 'pending' && (
                        <Button
                            variant="outline"
                            onClick={() => router.visit(`/inventory/purchase-orders/${order.id}/edit`)}
                            className="text-xs font-bold uppercase tracking-widest h-9"
                        >
                            Edit
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT COL: Financials */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-4">Cost Breakdown (MMK)</span>

                            <CostRow label="Total Goods Cost" value={order.total_goods_cost} />
                            {order.supplier_fee > 0 && <CostRow label="Supplier Service Fee" value={order.supplier_fee} />}

                            {order.cargo_fee > 0 && <CostRow label="Cargo Fee" value={order.cargo_fee} />}
                            {order.local_deli_fee > 0 && <CostRow label="Local Delivery" value={order.local_deli_fee} />}
                            {order.adjustment_amount !== undefined && order.adjustment_amount !== null && Number(order.adjustment_amount) !== 0 && (
                                <CostRow label={`Adjustment (${order.adjustment_reason})`} value={Number(order.adjustment_amount)} />
                            )}

                            <CostRow label="GRAND TOTAL" value={order.grand_total} isTotal />

                            <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-zinc-500 uppercase">Paid Amount</span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-sm font-black text-black dark:text-white">{formatMMK(order.paid_amount)}</span>
                                        <span className={twMerge("text-[10px] font-bold uppercase tracking-widest", order.payment_status === "paid" ? "text-green-600 dark:text-green-500" : "text-red-500")}>
                                            {order.payment_status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COL: Items */}
                    <div className="lg:col-span-2 flex flex-col gap-8">
                        <div>
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-4">Items ({order.items?.length || 0})</span>

                            <div className="flex flex-col border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-black">
                                {order.items?.map((item) => (
                                    <div key={item.id} className="p-4 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 flex flex-col gap-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 mr-4">
                                                <h4 className="font-bold text-black dark:text-white text-base mb-1">{item.product.name}</h4>
                                                <span className="text-xs text-zinc-500 block">
                                                    Ordered: {item.quantity} units @ {formatMMK(item.unit_cost)} (Rate: {order.exchange_rate})
                                                </span>
                                            </div>
                                            <span className="font-black text-black dark:text-white text-lg">
                                                {formatMMK(item.line_total)}
                                            </span>
                                        </div>

                                        <div>
                                            {isArrived && item.received_quantity !== null && item.received_quantity !== undefined && (
                                                <span className={twMerge("text-xs font-bold block mt-1",
                                                    item.received_quantity !== item.quantity ? "text-orange-600 dark:text-orange-500" : "text-green-600 dark:text-green-500"
                                                )}>
                                                    Received: {item.received_quantity} units
                                                    {item.batch_retail_price !== null && item.batch_retail_price !== undefined && (
                                                        <span className="text-zinc-500 ml-2 font-medium">
                                                            (Retail Price: {formatMMK(item.batch_retail_price)})
                                                        </span>
                                                    )}
                                                </span>
                                            )}

                                            {!isArrived && !isReceivingMode && item.retail_price !== null && item.retail_price !== undefined && (
                                                <span className="text-xs font-bold text-zinc-500 block mt-1">
                                                    Pending Retail Price: {formatMMK(item.retail_price)} MMK
                                                </span>
                                            )}

                                            {isReceivingMode && (
                                                <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-[10px] uppercase font-bold text-zinc-400 whitespace-nowrap">Received Qty:</Label>
                                                        <Input
                                                            type="number"
                                                            value={data.received_items.find(ri => ri.id === item.id)?.received_quantity || ''}
                                                            onChange={(e) => {
                                                                const newItems = [...data.received_items];
                                                                const idx = newItems.findIndex(ri => ri.id === item.id);
                                                                if (idx !== -1) {
                                                                    newItems[idx].received_quantity = e.target.value;
                                                                    setData('received_items', newItems);
                                                                }
                                                            }}
                                                            className="w-20 h-7 text-xs border-zinc-200 dark:border-zinc-800"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Label className="text-[10px] uppercase font-bold text-zinc-400 whitespace-nowrap">Retail Price: *</Label>
                                                        <Input
                                                            type="number"
                                                            value={data.received_items.find(ri => ri.id === item.id)?.retail_price || ''}
                                                            onChange={(e) => {
                                                                const newItems = [...data.received_items];
                                                                const idx = newItems.findIndex(ri => ri.id === item.id);
                                                                if (idx !== -1) {
                                                                    newItems[idx].retail_price = e.target.value;
                                                                    setData('received_items', newItems);
                                                                }
                                                            }}
                                                            className="w-24 h-7 text-xs border-zinc-200 dark:border-zinc-800"
                                                            required
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            {(!isArrived || isReceivingMode) && (
                                                <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Pricing History</span>
                                                    <div className="flex flex-wrap gap-4 text-xs">
                                                        {item.latest_retail_price ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-zinc-500 font-medium">Latest Retail</span>
                                                                <span className="font-bold text-black dark:text-white">{formatMMK(item.latest_retail_price)}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-zinc-400 italic">No previous batches</span>
                                                        )}

                                                        {item.previous_retail_prices && item.previous_retail_prices.length > 0 && (
                                                            <div className="flex flex-col">
                                                                <span className="text-zinc-500 font-medium">Previous</span>
                                                                <span className="font-bold text-black dark:text-white">{item.previous_retail_prices.map(p => formatMMK(p)).join(' / ')}</span>
                                                            </div>
                                                        )}

                                                        {item.pending_retail_price ? (
                                                            <div className="flex flex-col border-l border-zinc-200 dark:border-zinc-700 pl-4">
                                                                <span className="text-orange-500 dark:text-orange-400 font-medium">Other Pending</span>
                                                                <span className="font-bold text-orange-600 dark:text-orange-500">{formatMMK(item.pending_retail_price)}</span>
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {(!order.items || order.items.length === 0) && (
                                    <div className="p-8 flex justify-center text-zinc-400 text-sm">No items found.</div>
                                )}
                            </div>
                        </div>

                        {!isArrived && !isCancelled && (
                            <div className="flex flex-col gap-4">
                                {!isReceivingMode ? (
                                    <>
                                        <Button onClick={() => setIsReceivingMode(true)} className="w-full h-14 tracking-widest uppercase font-bold text-sm">
                                            RECEIVE BATCH (MARK ARRIVED)
                                        </Button>
                                        <Button onClick={() => setShowCancelModal(true)} variant="outline" className="w-full h-12 tracking-widest uppercase font-bold text-sm text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-900/20">
                                            CANCEL ORDER
                                        </Button>
                                    </>
                                ) : (
                                    <form onSubmit={handleConfirmArrive} className="p-6 bg-black dark:bg-zinc-900 rounded-2xl shadow-xl flex flex-col gap-4 text-white">
                                        <h3 className="text-lg font-black text-white">Finalize Costs</h3>
                                        <p className="text-xs text-zinc-400 mb-2">Enter additional fees to calculate true item cost.</p>

                                        <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-xl mb-2">
                                            <p className="text-[10px] text-green-400 font-bold uppercase tracking-widest">Auto-Settlement</p>
                                            <p className="text-xs text-green-300/80 mt-1">This order will be automatically marked as 100% paid in full upon confirmation.</p>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Label className="text-zinc-300">Cargo Fee (MMK)</Label>
                                            <Input
                                                type="number"
                                                value={data.cargo_fee}
                                                onChange={(e) => setData('cargo_fee', e.target.value)}
                                                placeholder="0"
                                                className="bg-zinc-900 border-zinc-800 text-white"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Label className="text-zinc-300">Local Delivery (MMK)</Label>
                                            <Input
                                                type="number"
                                                value={data.local_deli_fee}
                                                onChange={(e) => setData('local_deli_fee', e.target.value)}
                                                placeholder="0"
                                                className="bg-zinc-900 border-zinc-800 text-white"
                                            />
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <Label className="text-zinc-300">Adjustment Amount (MMK)</Label>
                                            <Input
                                                type="number"
                                                value={data.adjustment_amount}
                                                onChange={(e) => setData('adjustment_amount', e.target.value)}
                                                placeholder="e.g. -5000 or 2000"
                                                className="bg-zinc-900 border-zinc-800 text-white"
                                            />
                                            <span className="text-[10px] text-zinc-500 mt-0.5">Use negative numbers for discounts/missing items.</span>
                                        </div>

                                        {data.adjustment_amount && data.adjustment_amount !== '0' && (
                                            <div className="flex flex-col gap-2">
                                                <Label className="text-zinc-300">Adjustment Reason</Label>
                                                <Input
                                                    type="text"
                                                    value={data.adjustment_reason}
                                                    onChange={(e) => setData('adjustment_reason', e.target.value)}
                                                    placeholder="Required for adjustments"
                                                    className="bg-zinc-900 border-zinc-800 text-white"
                                                    required
                                                />
                                            </div>
                                        )}

                                        <div className="mt-4 flex flex-col gap-2">
                                            <Button type="submit" disabled={processing || (data.adjustment_amount !== '' && data.adjustment_amount !== '0' && !data.adjustment_reason)} variant="secondary" className="w-full bg-white text-black hover:bg-zinc-200 font-bold">
                                                CONFIRM & SETTLE FULLY
                                            </Button>
                                            <button type="button" onClick={() => setIsReceivingMode(false)} className="py-2 text-xs font-bold text-zinc-500 hover:text-white uppercase tracking-widest mt-2">
                                                CANCEL
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* ORDER HISTORY (AUDIT LOG) */}
            <div className="mt-12 mb-20 max-w-4xl mx-auto w-full px-4 md:px-0">
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Order History</h3>
                <div className="relative border-l-2 border-zinc-200 dark:border-zinc-800 ml-3 md:ml-4">
                    {Array.isArray(order.audit_log) && order.audit_log.length > 0 ? (
                        order.audit_log.map((log: any, idx: number) => (
                            <div key={idx} className="mb-8 ml-6 relative">
                                <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-blue-500 border-2 border-white dark:border-black"></div>
                                <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3 mb-1">
                                    <h4 className="font-bold text-black dark:text-white uppercase tracking-wide text-sm">
                                        {log.action.replace(/_/g, ' ')}
                                    </h4>
                                    <span className="text-xs text-zinc-500 font-medium">
                                        {new Date(log.at).toLocaleString()}
                                    </span>
                                </div>
                                <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                    By: <span className="font-bold text-black dark:text-white">{log.by}</span>
                                </div>
                                {log.details && Object.keys(log.details).length > 0 && (
                                    <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono overflow-x-auto flex flex-col gap-1">
                                        {Object.entries(log.details).map(([key, value]: any) => {
                                            if (key === 'changes' && typeof value === 'object' && value !== null) {
                                                return Object.entries(value).map(([changeKey, changeVal]: [string, any]) => (
                                                    <div key={changeKey} className="flex gap-4">
                                                        <span className="text-zinc-500 min-w-[120px] font-bold">{changeKey}:</span>
                                                        <div className="flex gap-2 items-center">
                                                            <span className="line-through text-red-400/70">{formatLogValue(changeVal?.old)}</span>
                                                            <span className="text-zinc-400">→</span>
                                                            <span className="text-green-600 dark:text-green-400 font-bold">{formatLogValue(changeVal?.new)}</span>
                                                        </div>
                                                    </div>
                                                ));
                                            }
                                            return (
                                                <div key={key} className="flex gap-4">
                                                    <span className="text-zinc-500 min-w-[120px] font-bold">{key}:</span>
                                                    <span className="text-black dark:text-white font-bold">{formatLogValue(value)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="ml-6 text-sm text-zinc-400 italic">No history available</div>
                    )}
                </div>
            </div>

            <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cancel Purchase Order?</DialogTitle>
                        <DialogDescription>
                            This will reverse pending stock and mark the PO as cancelled. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2 mt-4">
                        <Label>Cancel Reason (Optional)</Label>
                        <Input
                            placeholder="e.g. Supplier out of stock"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter className="mt-4">
                        <Button variant="destructive" onClick={handleCancel} className="w-full">
                            YES, CANCEL PURCHASE ORDER
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
