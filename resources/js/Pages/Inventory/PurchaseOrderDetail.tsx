import React, { useState, useEffect } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm, Link } from '@inertiajs/react';
import { PurchaseOrder } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
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
    const isPartiallyArrived = order.status === 'partially_arrived';
    const isCancelled = order.status === 'cancelled';
    const isPending = order.status === 'pending';
    const [isReceivingMode, setIsReceivingMode] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState("");
    const [refundAmount, setRefundAmount] = useState<string | number>("");

    const initialReceivedItems = order.items?.map(item => {
        const alreadyReceived = item.received_quantity || 0;
        const remaining = Math.max(0, item.quantity - alreadyReceived);
        const rp = item.retail_price || item.product_variant?.retail_price;
        return {
            id: item.id,
            received_quantity: remaining > 0 ? remaining.toString() : '0',
            retail_price: (rp === 0 || !rp) ? '' : rp.toString(),
            allocated_cargo_fee: '',
            allocated_adjustment_amount: ''
        };
    }) || [];

    const { data, setData, post, processing, errors, clearErrors } = useForm({
        cargo_fee: '',
        local_deli_fee: '',
        adjustment_amount: '',
        adjustment_reason: '',
        received_items: initialReceivedItems
    });

    const formatMMK = (val: number) => Math.round(Number(val)).toLocaleString();

    // Calculate total receiving now across items
    const totalReceivingNow = data.received_items.reduce((sum, ri) => sum + (Number(ri.received_quantity) || 0), 0);

    // Sum of item-level cargo fees
    const sumAllocatedCargo = data.received_items.reduce((sum, ri) => sum + (Number(ri.allocated_cargo_fee) || 0), 0);
    const effectiveShipmentCargo = sumAllocatedCargo > 0 ? sumAllocatedCargo : (Number(data.cargo_fee) || 0);
    const totalShipmentCashOutflow = effectiveShipmentCargo + (Number(data.local_deli_fee) || 0) + (Number(data.adjustment_amount) || 0);

    // Check if this shipment completes all remaining items
    const willFullyComplete = (order.items || []).every(item => {
        const alreadyReceived = item.received_quantity || 0;
        const remaining = Math.max(0, item.quantity - alreadyReceived);
        const receivingNow = Number(data.received_items.find(ri => ri.id === item.id)?.received_quantity) || 0;
        return receivingNow >= remaining;
    });

    const CostRow = ({ label, value, isTotal = false }: { label: string, value: number, isTotal?: boolean }) => (
        <div className={twMerge("flex justify-between items-start gap-4 mb-3", isTotal ? "mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 items-center" : "")}>
            <span className={twMerge("text-xs leading-relaxed", isTotal ? "font-black text-black dark:text-white" : "font-medium text-zinc-500")}>{label}</span>
            <span className={twMerge("text-xs shrink-0 text-right mt-0.5", isTotal ? "font-black text-black dark:text-white text-base mt-0" : "font-bold text-zinc-800 dark:text-zinc-300")}>
                {value !== 0 && value !== null && value !== undefined ? formatMMK(value) : "-"}
            </span>
        </div>
    );

    const handleConfirmArrive = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/inventory/purchase-orders/${order.id}/arrive`, {
            onSuccess: () => setIsReceivingMode(false),
            onError: () => alert('Failed to process shipment arrival')
        });
    };

    const handleCancel = () => {
        router.post(`/inventory/purchase-orders/${order.id}/cancel`, { 
            cancel_reason: cancelReason,
            refund_amount: refundAmount
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setShowCancelModal(false);
                setCancelReason("");
                setRefundAmount("");
            }
        });
    };

    const setItemField = (itemId: number, field: string, val: string) => {
        const newItems = [...data.received_items];
        const idx = newItems.findIndex(ri => ri.id === itemId);
        if (idx !== -1) {
            (newItems[idx] as any)[field] = val;
            setData('received_items', newItems);
            if (field === 'retail_price') {
                clearErrors(`received_items.${idx}.retail_price`);
            }
        }
    };

    return (
        <AppLayout title={order.batch_name}>
            <Head title={`PO: ${order.batch_name}`} />

            <div className="flex flex-col max-w-4xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/inventory/purchase-orders" className="text-zinc-500 hover:text-black dark:hover:text-white text-xl">←</Link>
                        <div>
                            <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">{order.batch_name}</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={twMerge("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border",
                                    isArrived ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white" :
                                        isPartiallyArrived ? "bg-amber-50 dark:bg-amber-950/40 border-amber-500/50 text-amber-600 dark:text-amber-400" :
                                            isCancelled ? "bg-transparent border-zinc-300 dark:border-zinc-700 text-zinc-500 line-through decoration-zinc-400" :
                                                "bg-transparent border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400")}>
                                    {order.status.replace(/_/g, ' ')}
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
                    {(order.status === 'pending' || order.status === 'partially_arrived') && !isReceivingMode && (
                        <Link
                            href={`/inventory/purchase-orders/${order.id}/edit`}
                            className="inline-flex items-center justify-center border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold uppercase tracking-widest h-9 px-4 rounded-md transition-colors"
                        >
                            Edit
                        </Link>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT COL: Financials */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-4">Cost Breakdown (MMK)</span>

                            {order.order_type === 'global' ? (
                                <CostRow label={`Total Goods Cost (${order.total_goods_cost.toLocaleString()} ${order.supplier?.currency || 'CNY'})`} value={order.total_goods_cost * order.exchange_rate} />
                            ) : (
                                <CostRow label="Total Goods Cost" value={order.total_goods_cost} />
                            )}

                            {Number(order.foreign_deli_fee) > 0 && <CostRow label={`Foreign Delivery (${(order.foreign_deli_fee || 0).toLocaleString()} ${order.supplier?.currency || 'CNY'})`} value={(order.foreign_deli_fee || 0) * order.exchange_rate} />}
                            {Number(order.total_discount) > 0 && <CostRow label={`Total Discount (${(order.total_discount || 0).toLocaleString()} ${order.supplier?.currency || 'CNY'})`} value={-(order.total_discount || 0) * order.exchange_rate} />}
                            {order.supplier_fee > 0 && <CostRow label={`Supplier Service Fee (${order.supplier_fee.toLocaleString()} ${order.supplier?.currency || 'CNY'})`} value={order.supplier_fee * order.exchange_rate} />}

                            {order.cargo_fee > 0 && <CostRow label="Cargo Fee (Cumulative)" value={order.cargo_fee} />}
                            {order.local_deli_fee > 0 && <CostRow label="Local Delivery" value={order.local_deli_fee} />}
                            {order.adjustment_amount !== undefined && order.adjustment_amount !== null && Number(order.adjustment_amount) !== 0 && (
                                <CostRow label={`Adjustment (${order.adjustment_reason || 'Misc'})`} value={Number(order.adjustment_amount)} />
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

                    {/* RIGHT COL: Items & Receiving */}
                    <div className="lg:col-span-2 flex flex-col gap-8">
                        {!isReceivingMode ? (
                            <div>
                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-4">Items ({order.items?.length || 0})</span>

                                <div className="flex flex-col border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-black">
                                    {order.items?.map((item) => {
                                        const alreadyReceived = item.received_quantity || 0;
                                        const isFullyReceived = alreadyReceived >= item.quantity;
                                        const isPartiallyRcvd = alreadyReceived > 0 && alreadyReceived < item.quantity;

                                        return (
                                            <div key={item.id} className="p-4 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 flex flex-col gap-2">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1 mr-4">
                                                        <h4 className="font-bold text-black dark:text-white text-base mb-1">
                                                            {item.product_variant?.product?.name} - {Object.values(item.product_variant?.attributes || {}).join(' / ') || 'Default'}
                                                        </h4>
                                                        <span className="text-xs text-zinc-500 block">
                                                            Ordered: {item.quantity} units @ {formatMMK(item.unit_cost)} MMK
                                                            {order.order_type === 'global' && (
                                                                <span className="text-zinc-400 ml-1">
                                                                    (Original: {item.original_cost} {order.supplier?.currency || 'CNY'}, Rate: {order.exchange_rate})
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="font-black text-black dark:text-white text-lg">
                                                            {formatMMK(item.line_total)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    {isFullyReceived ? (
                                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
                                                            ✓ Received: {alreadyReceived} / {item.quantity}
                                                        </span>
                                                    ) : isPartiallyRcvd ? (
                                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                                            ⚡ Received: {alreadyReceived} / {item.quantity} ({item.quantity - alreadyReceived} remaining)
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] font-medium text-zinc-400">
                                                            Pending Arrival (0 / {item.quantity} received)
                                                        </span>
                                                    )}

                                                    {Number(item.allocated_cargo_fee) > 0 && (
                                                        <span className="text-[11px] text-zinc-500 font-medium ml-2">
                                                            Cargo Paid: {formatMMK(Number(item.allocated_cargo_fee))} MMK
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {(!order.items || order.items.length === 0) && (
                                        <div className="p-8 flex justify-center text-zinc-400 text-sm">No items found.</div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* RECEIVING MODE - MOBILE FIRST PRODUCT CARDS */
                            <form onSubmit={handleConfirmArrive} className="flex flex-col gap-6">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-lg font-black text-black dark:text-white">Receive Shipment</h3>
                                        <p className="text-xs text-zinc-500">Enter arriving quantities and cargo fees for this specific shipment.</p>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsReceivingMode(false)}
                                        className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white"
                                    >
                                        ✕ Cancel
                                    </button>
                                </div>

                                <div className="flex flex-col gap-4">
                                    {order.items?.map((item) => {
                                        const alreadyReceived = item.received_quantity || 0;
                                        const remaining = Math.max(0, item.quantity - alreadyReceived);
                                        const itemForm = data.received_items.find(ri => ri.id === item.id);
                                        const receivingNow = Number(itemForm?.received_quantity) || 0;
                                        const isCompleted = remaining === 0;

                                        const itemCargo = Number(itemForm?.allocated_cargo_fee) || 0;
                                        const estUnitCargo = receivingNow > 0 ? (itemCargo / receivingNow) : 0;
                                        const baseUnitCost = item.unit_cost || (item.original_cost * order.exchange_rate);
                                        const estLandedCost = baseUnitCost + estUnitCargo;

                                        return (
                                            <div 
                                                key={item.id} 
                                                className={twMerge(
                                                    "p-4 rounded-2xl border transition-all duration-200",
                                                    isCompleted 
                                                        ? "bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-100 dark:border-zinc-800 opacity-60" 
                                                        : receivingNow > 0 
                                                            ? "bg-white dark:bg-zinc-900 border-black dark:border-white shadow-sm" 
                                                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                                )}
                                            >
                                                {/* Header */}
                                                <div className="flex justify-between items-start gap-2 mb-3">
                                                    <div>
                                                        <h4 className="font-bold text-black dark:text-white text-sm sm:text-base">
                                                            {item.product_variant?.product?.name}
                                                        </h4>
                                                        <p className="text-xs text-zinc-500 font-medium">
                                                            {Object.values(item.product_variant?.attributes || {}).join(' / ') || 'Default Variant'}
                                                        </p>
                                                    </div>
                                                    <span className={twMerge(
                                                        "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider",
                                                        isCompleted 
                                                            ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300"
                                                            : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                                                    )}>
                                                        {alreadyReceived} / {item.quantity} Received
                                                    </span>
                                                </div>

                                                {isCompleted ? (
                                                    <p className="text-xs text-zinc-400 italic">This product has been fully received in prior shipments.</p>
                                                ) : (
                                                    <div className="flex flex-col gap-4">
                                                        {/* Stepper and quick fill */}
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                                                            <div>
                                                                <Label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                                                                    Arriving in This Shipment:
                                                                </Label>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const val = Math.max(0, receivingNow - 1);
                                                                            setItemField(item.id, 'received_quantity', val.toString());
                                                                        }}
                                                                        className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-sm flex items-center justify-center transition-colors"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <Input
                                                                        type="number"
                                                                        value={itemForm?.received_quantity || ''}
                                                                        onChange={(e) => setItemField(item.id, 'received_quantity', e.target.value)}
                                                                        className="w-16 h-8 text-center text-sm font-bold border-zinc-200 dark:border-zinc-800"
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const val = Math.min(remaining, receivingNow + 1);
                                                                            setItemField(item.id, 'received_quantity', val.toString());
                                                                        }}
                                                                        className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 font-bold text-sm flex items-center justify-center transition-colors"
                                                                    >
                                                                        +
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setItemField(item.id, 'received_quantity', remaining.toString())}
                                                                        className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 ml-1 transition-colors"
                                                                    >
                                                                        All ({remaining})
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setItemField(item.id, 'received_quantity', '0')}
                                                                        className="text-[11px] font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 px-1"
                                                                    >
                                                                        None
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Item Cargo Fee */}
                                                            {receivingNow > 0 && (
                                                                <div className="flex-1 sm:max-w-[200px]">
                                                                    <Label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">
                                                                        Cargo Fee (MMK):
                                                                    </Label>
                                                                    <FormattedNumberInput
                                                                        value={itemForm?.allocated_cargo_fee || ''}
                                                                        onChange={(val) => setItemField(item.id, 'allocated_cargo_fee', val)}
                                                                        placeholder="0"
                                                                        className="h-8 text-xs border-zinc-200 dark:border-zinc-800"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Retail Price & Landed preview */}
                                                        {receivingNow > 0 && (
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                                                                <div className="flex items-center gap-2">
                                                                    <Label className="text-[10px] uppercase font-bold text-zinc-400 whitespace-nowrap">
                                                                        Retail Price:
                                                                    </Label>
                                                                    <FormattedNumberInput
                                                                        value={itemForm?.retail_price || ''}
                                                                        onChange={(val) => setItemField(item.id, 'retail_price', val)}
                                                                        placeholder="Set Retail"
                                                                        className="w-28 h-7 text-xs border-zinc-200 dark:border-zinc-800"
                                                                    />
                                                                </div>
                                                                <div className="flex items-center gap-2 text-zinc-500 font-medium">
                                                                    <span>Est. Landed Cost:</span>
                                                                    <span className="font-bold text-black dark:text-white">
                                                                        ~{formatMMK(estLandedCost)} MMK / unit
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* SHIPMENT SUMMARY & SUBMISSION */}
                                <div className="p-6 bg-zinc-950 text-white rounded-2xl shadow-xl flex flex-col gap-4">
                                    <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                                        <h4 className="font-black text-sm uppercase tracking-widest text-zinc-300">Shipment Summary</h4>
                                        <span className="text-xs font-bold text-zinc-400">{totalReceivingNow} pcs arriving</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-[10px] uppercase font-bold text-zinc-400">Total Shipment Cargo (MMK)</Label>
                                            <div className="text-base font-black text-white mt-1">
                                                {formatMMK(effectiveShipmentCargo)} MMK
                                            </div>
                                        </div>

                                        <div>
                                            <Label className="text-[10px] uppercase font-bold text-zinc-400">Local Delivery / Taxi Fee (MMK)</Label>
                                            <FormattedNumberInput
                                                value={data.local_deli_fee}
                                                onChange={(val) => { setData('local_deli_fee', val); clearErrors('local_deli_fee'); }}
                                                placeholder="0"
                                                className="bg-zinc-900 border-zinc-800 text-white h-8 mt-1 text-xs"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center pt-3 border-t border-zinc-800">
                                        <div>
                                            <span className="text-[10px] uppercase font-bold text-zinc-400 block">Finance Cash Outflow</span>
                                            <span className="text-lg font-black text-white">{formatMMK(totalShipmentCashOutflow)} MMK</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] uppercase font-bold text-zinc-400 block">PO Status After</span>
                                            <span className={twMerge("text-xs font-bold uppercase tracking-wider", willFullyComplete ? "text-green-400" : "text-amber-400")}>
                                                {willFullyComplete ? "✓ Fully Complete (Arrived)" : "⚡ Partially Arrived"}
                                            </span>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={processing || totalReceivingNow === 0}
                                        className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-bold uppercase tracking-wider text-xs mt-2"
                                    >
                                        {willFullyComplete 
                                            ? `CONFIRM & COMPLETE PURCHASE ORDER (${totalReceivingNow} PCS)`
                                            : `RECEIVE PARTIAL SHIPMENT (${totalReceivingNow} PCS)`
                                        }
                                    </Button>
                                </div>
                            </form>
                        )}

                        {!isArrived && !isCancelled && !isReceivingMode && (
                            <div className="flex flex-col gap-4">
                                <Button onClick={() => setIsReceivingMode(true)} className="w-full h-14 tracking-widest uppercase font-bold text-sm">
                                    {isPartiallyArrived ? "RECEIVE NEXT SHIPMENT" : "RECEIVE SHIPMENT (MARK ARRIVED)"}
                                </Button>
                                <Button onClick={() => setShowCancelModal(true)} variant="outline" className="w-full h-12 tracking-widest uppercase font-bold text-sm text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-900/20">
                                    CANCEL ORDER
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* ORDER HISTORY (AUDIT LOG) */}
            <div className="mt-12 mb-20 max-w-4xl mx-auto w-full px-4 md:px-0">
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Order History</h3>
                <div className="relative border-l-2 border-zinc-200 dark:border-zinc-800 ml-3 md:ml-4">
                    {Array.isArray(order.activities) && order.activities.length > 0 ? (
                        order.activities.map((log: any, idx: number) => (
                            <div key={idx} className="mb-8 ml-6 relative">
                                <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-blue-500 border-2 border-white dark:border-black"></div>
                                <div className="flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3 mb-1">
                                    <h4 className="font-bold text-black dark:text-white uppercase tracking-wide text-sm">
                                        {log.description.replace(/_/g, ' ')}
                                    </h4>
                                    <span className="text-xs text-zinc-500 font-medium">
                                        {new Date(log.created_at).toLocaleString()}
                                    </span>
                                </div>
                                <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                                    By: <span className="font-bold text-black dark:text-white">{log.causer?.name || log.properties?.by || 'System'}</span>
                                </div>
                                {log.properties?.details && Object.keys(log.properties.details).length > 0 && (
                                    <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono overflow-x-auto flex flex-col gap-1">
                                        {Object.entries(log.properties.details).map(([key, value]: any) => {
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
                        {order.paid_amount > 0 && (
                            <div className="flex flex-col gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-2">
                                <Label>Refund Amount (Max: {formatMMK(order.paid_amount)} MMK)</Label>
                                <FormattedNumberInput
                                    placeholder={order.paid_amount.toString()}
                                    value={refundAmount}
                                    onChange={(val) => setRefundAmount(val)}
                                />
                                <p className="text-xs text-zinc-500">
                                    If the supplier issues a partial refund, the difference will be logged as a Sunk Cost Expense. Leave blank to log a full refund.
                                </p>
                            </div>
                        )}
                        <Button variant="destructive" onClick={handleCancel} className="w-full mt-4">
                            YES, CANCEL PURCHASE ORDER
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
