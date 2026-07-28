import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, Link, usePage, useForm } from '@inertiajs/react';
import { SalesOrder } from '@/types/sales';
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

export default function SalesDetail({ order }: { order: SalesOrder }) {
    const paymentMethods = usePage<any>().props.auth?.payment_methods || [];
    const [modalAction, setModalAction] = useState<{
        type: "settle" | "cancel" | "return";
        itemId?: number;
        maxQty?: number;
    } | null>(null);
    const [cancelReason, setCancelReason] = useState("");

    const { data: returnData, setData: setReturnData, post: postReturn, processing: returning, clearErrors, errors: returnErrors } = useForm({
        quantity: '',
        reason: ''
    });

    const isCancelled = order.status.toUpperCase() === "CANCELLED";
    const isCompleted = order.status.toUpperCase() === "COMPLETED";
    const isPending = order.status.toUpperCase() === "PENDING";
    const isSettled = order.delivery.settlement_status === "settled";

    const balance = order.financials.balance;
    const isRefundNeeded = balance < -0.1;
    const isFullyPaid = Math.abs(balance) < 1 || isCompleted || isSettled;

    let statusText = "DUE";
    let statusColor = "text-black dark:text-white";

    if (isRefundNeeded) {
        statusText = "REFUND DUE";
        statusColor = "text-zinc-800 dark:text-zinc-200";
    } else if (isFullyPaid) {
        statusText = "SETTLED";
        statusColor = "text-black dark:text-white";
    }

    let settleButtonText = "";
    if (order.delivery.collected_by === "courier" && order.delivery.settlement_status === "unpaid") {
        settleButtonText = "CONFIRM COURIER TRANSFER";
    } else if (isRefundNeeded) {
        settleButtonText = `ISSUE REFUND (${Math.abs(balance).toLocaleString()})`;
    } else {
        settleButtonText = `COLLECT BALANCE (${balance.toLocaleString()})`;
    }

    const isCourierUnpaid = order.delivery.collected_by === "courier" && order.delivery.settlement_status === "unpaid";
    const canSettle = isRefundNeeded || (!isFullyPaid && (
        isCourierUnpaid 
            ? order.status.toLowerCase() === 'delivered' 
            : ['pending', 'delivery_added', 'delivered'].includes(order.status.toLowerCase())
    ));

    const formatMMK = (val: number) => Math.round(Number(val)).toLocaleString();

    const openReturnModal = (itemId: number, maxQty: number) => {
        setReturnData({ quantity: '', reason: '' });
        setModalAction({ type: "return", itemId, maxQty });
    };

    const confirmReturn = () => {
        if (modalAction?.type === "return" && modalAction.itemId && modalAction.maxQty) {
            const qty = Number(returnData.quantity);
            if (qty > 0 && qty <= modalAction.maxQty) {
                postReturn(`/sales/${order.id}/items/${modalAction.itemId}/return`, {
                    preserveScroll: true,
                    onSuccess: () => setModalAction(null)
                });
            } else {
                alert("Invalid quantity");
            }
        }
    };

    const handleSettle = (method: string) => {
        router.post(`/sales/${order.id}/settle`, { payment_method: method }, {
            preserveScroll: true,
            onSuccess: () => setModalAction(null)
        });
    };

    const handleCancel = () => {
        router.post(`/sales/${order.id}/cancel`, { cancel_reason: cancelReason }, {
            preserveScroll: true,
            onSuccess: () => {
                setModalAction(null);
                setCancelReason("");
            }
        });
    };

    const renderDiscountBadge = (type?: string, value?: number) => {
        if (!type || !value || type === "none") return null;
        if (type === "percent") return <span className="text-[10px] text-green-600 font-bold ml-1">({value}% OFF)</span>;
        if (type === "fixed") return <span className="text-[10px] text-green-600 font-bold ml-1">(-{formatMMK(value)})</span>;
        return null;
    };

    const CostRow = ({ label, value, isBold = false, color = "text-black dark:text-white", prefix = "" }: any) => (
        <div className="flex justify-between mb-2">
            <span className={twMerge("text-xs", isBold ? "font-bold text-zinc-700 dark:text-zinc-300" : "text-zinc-500 dark:text-zinc-400")}>
                {label}
            </span>
            <span className={twMerge("text-xs", isBold ? "font-black" : "font-medium", color)}>
                {value !== undefined ? `${prefix}${formatMMK(value)}` : "-"} MMK
            </span>
        </div>
    );

    return (
        <AppLayout title={`Order #${order.id}`}>
            <Head title={`Order #${order.id}`} />

            <div className="flex flex-col max-w-4xl mx-auto w-full pb-20">

                {/* Header */}
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.visit('/sales')} className="text-zinc-500 hover:text-black dark:hover:text-white text-xl">←</button>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">Order #{order.id}</h1>
                                {order.is_preorder && (
                                    <span className="px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest rounded-md">
                                        PREORDER
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-medium text-zinc-500">{order.date}</p>
                        </div>
                    </div>
                    {['pending', 'delivery_added'].includes(order.status.toLowerCase()) && (
                        <Button
                            variant="outline"
                            onClick={() => router.visit(`/sales/${order.id}/edit`)}
                            className="text-xs font-bold uppercase tracking-widest h-9"
                        >
                            Edit
                        </Button>
                    )}
                </div>

                {/* 1. STATUS BANNER */}
                <div className={twMerge("p-5 rounded-2xl mb-8 flex justify-between items-center border border-transparent",
                    isCancelled ? "bg-transparent border-zinc-300 dark:border-zinc-700" :
                        isRefundNeeded ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-400 dark:border-zinc-500" :
                            isFullyPaid ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white" :
                                "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800")}>
                    <div>
                        <span className={twMerge("text-xs font-bold uppercase tracking-widest", isFullyPaid ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500")}>Status</span>
                        <h2 className={twMerge("text-xl font-black", isCancelled ? "text-zinc-500 line-through decoration-zinc-400" : isFullyPaid ? "text-white dark:text-black uppercase" : "text-black dark:text-white uppercase")}>{order.status.replace(/_/g, ' ')}</h2>
                        {isCancelled && order.cancel_reason && (
                            <p className="text-sm font-bold mt-1 text-zinc-500">Reason: {order.cancel_reason}</p>
                        )}
                    </div>
                    <div className="text-right">
                        <span className={twMerge("text-xs font-bold uppercase tracking-widest", isFullyPaid ? "text-zinc-400 dark:text-zinc-500" : "text-zinc-500")}>Balance</span>
                        <h2 className={twMerge("text-lg font-black uppercase", isFullyPaid ? "text-white dark:text-black" : statusColor)}>{statusText}</h2>
                    </div>
                </div>

                {isPending && !isCancelled && (
                    <Button onClick={() => router.visit(`/sales/${order.id}/fulfill`)} className="mb-8 h-14 w-full text-sm tracking-widest uppercase font-bold">
                        📦 Arrange Delivery
                    </Button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    {/* 2. CUSTOMER & LOGISTICS */}
                    <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                        <div className="mb-6">
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-2">Customer</span>
                            <h3 className="text-xl font-bold text-black dark:text-white">{order.customer.name || 'Unknown'}</h3>
                            {order.customer.phone && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{order.customer.phone}</p>}
                            {order.customer.address && <p className="text-sm text-zinc-500 italic mt-2">{order.customer.address}</p>}
                        </div>

                        <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-4" />

                        <div>
                            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-3">Logistics</span>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm text-zinc-500">Courier</span>
                                <span className="text-sm font-bold text-black dark:text-white">{order.delivery.courier_name || '-'}</span>
                            </div>
                            {order.delivery.tracking && (
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm text-zinc-500">Tracking</span>
                                    <span className="text-sm font-bold text-black dark:text-white">{order.delivery.tracking}</span>
                                </div>
                            )}
                            
                            {order.delivery.courier_name && order.delivery.courier_name !== '-' && (
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm text-zinc-500">Delivery Payment</span>
                                    <span className="text-sm font-bold text-black dark:text-white uppercase">
                                        {order.delivery.collected_by === 'courier' ? 'COD' : (order.delivery.is_prepaid ? 'Fully Prepaid' : 'Items Prepaid')}
                                    </span>
                                </div>
                            )}

                            {order.note && (
                                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-100 dark:border-yellow-900/30">
                                    <span className="text-[10px] font-bold text-yellow-700 dark:text-yellow-500 uppercase block mb-1">Order Note</span>
                                    <p className="text-sm text-yellow-800 dark:text-yellow-400 whitespace-pre-wrap">{order.note}</p>
                                </div>
                            )}

                            {order.delivery.note && (
                                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-500 uppercase block mb-1">Delivery Note</span>
                                    <p className="text-sm text-blue-800 dark:text-blue-400 whitespace-pre-wrap">{order.delivery.note}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-8">
                        {/* 4a. CUSTOMER RECEIPT */}
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-4">Customer Receipt</span>
                                <CostRow label="Subtotal" value={order.financials.subtotal} />

                                {order.financials.discount > 0 && (
                                    <div className="mb-2">
                                        <div className="flex justify-between">
                                            <div className="flex items-center">
                                                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Order Discount</span>
                                                {renderDiscountBadge(order.financials.discount_type, order.financials.discount_value)}
                                            </div>
                                            <span className="text-xs font-medium text-green-600 dark:text-green-500">-{formatMMK(order.financials.discount)} MMK</span>
                                        </div>
                                        {order.financials.discount_reason && (
                                            <p className="text-[10px] text-zinc-400 italic mt-0.5">{order.financials.discount_reason}</p>
                                        )}
                                    </div>
                                )}

                                {order.financials.extra_fee > 0 && <CostRow label="Extra Fee (Payment)" value={order.financials.extra_fee} />}
                                {order.financials.overcharge > 0 && <CostRow label="Overcharge" value={order.financials.overcharge} />}

                                {order.delivery.fee > 0 && <CostRow label="Delivery Fee" value={order.delivery.fee} />}
                            </div>

                            <div>
                                <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-4" />

                                <div className="flex justify-between items-center">
                                    <span className="text-black dark:text-white font-black text-sm uppercase">Grand Total</span>
                                    <span className="text-black dark:text-white font-black text-xl">{formatMMK(order.financials.grand_total)} MMK</span>
                                </div>
                            </div>
                        </div>

                        {/* 4b. COLLECTION & PAYMENTS */}
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col justify-between">
                            <div>
                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-4">Collection & Payments</span>
                                
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-zinc-500 text-sm font-medium">Target Collection</span>
                                    <span className="text-black dark:text-white font-bold text-sm">
                                        {order.delivery.collected_by === 'courier' ? formatMMK(order.financials.net_revenue) : formatMMK(order.financials.grand_total)} MMK
                                    </span>
                                </div>

                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-zinc-500 text-sm font-medium">Paid So Far</span>
                                    <span className={twMerge("font-bold text-sm", order.financials.payment_status === "paid" ? "text-green-600 dark:text-green-500" : "text-orange-500")}>
                                        {formatMMK(order.financials.paid_amount)} MMK
                                    </span>
                                </div>
                                
                                <div className="flex justify-between items-center pt-4 border-t border-zinc-200 dark:border-zinc-800">
                                    <span className="text-black dark:text-white font-black text-sm uppercase">Balance Due</span>
                                    <span className={twMerge("font-black text-xl", Math.abs(order.financials.balance) < 1 ? "text-black dark:text-white" : "text-orange-500")}>
                                        {formatMMK(Math.abs(order.financials.balance))} MMK
                                    </span>
                                </div>
                            </div>

                            {order.payments && order.payments.length > 0 && (
                                <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-800 border-dashed">
                                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-3">Payment History</span>
                                    <div className="flex flex-col gap-2">
                                        {order.payments.map((payment: any, index: number) => (
                                            <div key={payment.id} className="flex justify-between items-center text-sm">
                                                <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                                                    <span className="text-[10px] tabular-nums font-mono">{payment.date}</span>
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50">
                                                        {paymentMethods.find((m: any) => m.code === payment.method)?.name || payment.method}
                                                    </span>
                                                </div>
                                                <span className="font-bold text-black dark:text-white tabular-nums">+{formatMMK(payment.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. ITEMS */}
                <div className="mb-8">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-4">Items</span>

                    <div className="flex flex-col border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
                        {order.items.map((item) => {
                            const originalTotal = item.quantity * item.price;
                            const actualTotal = item.total;
                            const diff = originalTotal - actualTotal;
                            const hasDiscount = diff > 0;

                            return (
                                <div key={item.id} className="p-4 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 bg-white dark:bg-black">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 mr-4">
                                            <h4 className="font-bold text-black dark:text-white text-base mb-1">{item.product_name}</h4>
                                            <div className="flex items-center flex-wrap gap-2">
                                                <span className="text-sm text-zinc-500">{item.quantity} x {formatMMK(item.price)}</span>
                                                {item.discount_type !== "none" ? renderDiscountBadge(item.discount_type, item.discount_value) : hasDiscount && (
                                                    <span className="text-[10px] text-green-600 font-bold">(DISCOUNTED)</span>
                                                )}
                                            </div>

                                            {hasDiscount && (
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-[10px] text-green-700 bg-green-50 dark:bg-green-900/30 dark:text-green-400 font-bold px-2 py-1 rounded">
                                                        SAVE -{formatMMK(diff)}
                                                    </span>
                                                    {item.discount_reason && <span className="text-xs text-zinc-400 italic">({item.discount_reason})</span>}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col items-end gap-2">
                                            <div className="text-right">
                                                {hasDiscount && <span className="text-[10px] text-zinc-400 line-through block">{formatMMK(originalTotal)}</span>}
                                                <span className="font-black text-black dark:text-white text-lg">{formatMMK(actualTotal)}</span>
                                            </div>

                                            {!isCancelled && (
                                                <button onClick={() => openReturnModal(item.id, item.quantity)} className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">
                                                    RETURN
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 5. MANAGER VIEW (Internal) */}
                {!isCancelled && (
                    <div className="mb-8 p-6 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block mb-4">Manager View (Internal)</span>

                        <CostRow label="Total Revenue (Cash In)" value={order.financials.net_revenue} isBold />
                        <CostRow label="Total Item Cost" value={order.financials.total_cost} color="text-zinc-500 dark:text-zinc-400" />

                        {order.delivery.courier_service_fee > 0 && (
                            <CostRow label="Service Fee (Deduction)" value={order.delivery.courier_service_fee} color="text-orange-500" prefix="-" />
                        )}

                        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                            <CostRow
                                label="NET PROFIT"
                                value={order.financials.profit}
                                isBold
                                color={(order.financials.profit || 0) >= 0 ? "text-green-600 dark:text-green-500" : "text-red-500"}
                            />
                        </div>
                    </div>
                )}

                {/* 6. ACTION BUTTONS */}
                {!isCancelled && (
                    <div className="flex flex-col gap-4">
                        {order.status.toLowerCase() === "delivery_added" && (
                            <Button onClick={() => router.post(`/sales/${order.id}/deliver`, {}, { preserveScroll: true })} className="h-12 w-full font-bold bg-blue-600 hover:bg-blue-700 text-white">
                                MARK AS DELIVERED
                            </Button>
                        )}

                        {canSettle && (
                            <Button onClick={() => setModalAction({ type: "settle" })} variant={isRefundNeeded ? "destructive" : "default"} className="h-12 w-full font-bold">
                                {settleButtonText}
                            </Button>
                        )}

                        {!isSettled && !isCompleted && (
                            <Button onClick={() => setModalAction({ type: "cancel" })} variant="outline" className="h-12 w-full font-bold border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-900/20">
                                CANCEL ORDER
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {/* 7. ORDER HISTORY (AUDIT LOG) */}
            <div className="mt-12 mb-20 max-w-2xl mx-auto w-full">
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
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">By {log.causer?.name || log.properties?.by || 'System'}</p>
                                {log.properties?.details && Object.keys(log.properties.details).length > 0 && (
                                    <div className="mt-2 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg text-xs font-mono text-zinc-500 overflow-x-auto flex flex-col gap-1">
                                        {Object.entries(log.properties.details).map(([key, value]) => {
                                            if (key === 'changes' && typeof value === 'object' && value !== null) {
                                                return Object.entries(value).map(([changeKey, changeVal]: [string, any]) => (
                                                    <div key={changeKey}>
                                                        <span className="font-bold text-zinc-700 dark:text-zinc-300">{changeKey}:</span>{' '}
                                                        <span className="line-through text-red-400/70">{formatLogValue(changeVal?.old)}</span>{' '}
                                                        <span className="text-zinc-400">→</span>{' '}
                                                        <span className="text-green-600 dark:text-green-400">{formatLogValue(changeVal?.new)}</span>
                                                    </div>
                                                ));
                                            }
                                            return (
                                                <div key={key}><span className="font-bold text-zinc-700 dark:text-zinc-300">{key}:</span> {formatLogValue(value)}</div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="ml-6 text-sm text-zinc-500 italic">No history recorded for this order.</div>
                    )}
                </div>
            </div>

            {/* MODALS using Shadcn Dialog */}
            <Dialog open={modalAction !== null} onOpenChange={(open) => { if (!open) { setModalAction(null); clearErrors(); setReturnData({ quantity: '', reason: '' }); setCancelReason(''); } }}>
                <DialogContent>
                    {modalAction?.type === "settle" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>{isRefundNeeded ? "Confirm Refund" : "Confirm Payment"}</DialogTitle>
                                <DialogDescription>
                                    {isRefundNeeded ? `Issue refund of ${formatMMK(Math.abs(balance))} MMK?` : `Received remaining ${formatMMK(balance)} MMK?`}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-wrap gap-2 mt-4">
                                                {paymentMethods.length > 0 ? paymentMethods.map((method: any) => (
                                                    <Button 
                                                        key={method.code}
                                                        onClick={() => handleSettle(method.code)} 
                                                        variant="outline" 
                                                        className="flex-1 min-w-[80px] bg-white text-black dark:bg-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-800"
                                                    >
                                                        {method.name}
                                                    </Button>
                                                )) : (
                                                    <div className="text-sm text-zinc-500 italic py-2">No payment methods configured.</div>
                                                )}
                                            </div>
                        </>
                    )}

                    {modalAction?.type === "cancel" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Cancel Order?</DialogTitle>
                                <DialogDescription>This action cannot be undone.</DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col gap-2 mt-4">
                                <Label>Cancel Reason (Optional)</Label>
                                <Input
                                    placeholder="e.g. Customer changed mind"
                                    value={cancelReason}
                                    onChange={(e) => setCancelReason(e.target.value)}
                                />
                            </div>
                            <DialogFooter className="mt-4">
                                <Button variant="destructive" onClick={handleCancel} className="w-full">
                                    YES, CANCEL ORDER
                                </Button>
                            </DialogFooter>
                        </>
                    )}

                    {modalAction?.type === "return" && (
                        <>
                            <DialogHeader>
                                <DialogTitle>Return Item</DialogTitle>
                                <DialogDescription>Specify quantity and reason for return.</DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col gap-4 mt-4">
                                <div className="flex flex-col gap-2">
                                    <Label>Quantity (Max: {modalAction.maxQty})</Label>
                                    <Input
                                        type="number"
                                        value={returnData.quantity}
                                        onChange={(e) => { setReturnData('quantity', e.target.value); clearErrors('quantity'); }}
                                        min="1"
                                        max={modalAction.maxQty}
                                    />
                                    {returnErrors.quantity && <span className="text-red-500 text-xs">{returnErrors.quantity}</span>}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>Reason (Optional)</Label>
                                    <Input
                                        placeholder="e.g. Defect"
                                        value={returnData.reason}
                                        onChange={(e) => { setReturnData('reason', e.target.value); clearErrors('reason'); }}
                                    />
                                    {returnErrors.reason && <span className="text-red-500 text-xs">{returnErrors.reason}</span>}
                                </div>
                            </div>
                            <DialogFooter className="mt-4">
                                <Button variant="destructive" onClick={confirmReturn} disabled={returning} className="w-full">
                                    CONFIRM RETURN
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

        </AppLayout>
    );
}
