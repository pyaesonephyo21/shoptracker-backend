import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { PurchaseOrder } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { twMerge } from 'tailwind-merge';

export default function PurchaseOrderDetail({ order }: { order: PurchaseOrder }) {
    const isArrived = order.status === 'arrived';
    const [isReceivingMode, setIsReceivingMode] = useState(false);

    const { data, setData, post, processing } = useForm({
        cargo_fee: '',
        local_deli_fee: '',
        adjustment_amount: '',
        adjustment_reason: ''
    });

    const formatMMK = (val: number) => Number(val).toLocaleString();

    const CostRow = ({ label, value, isTotal = false }: { label: string, value: number, isTotal?: boolean }) => (
        <div className={twMerge("flex justify-between items-center mb-2", isTotal ? "mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700" : "")}>
            <span className={twMerge("text-xs", isTotal ? "font-black text-black dark:text-white" : "font-medium text-zinc-500")}>{label}</span>
            <span className={twMerge("text-xs", isTotal ? "font-black text-black dark:text-white text-base" : "font-bold text-zinc-800 dark:text-zinc-300")}>
                {value > 0 ? formatMMK(value) : "-"}
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
                                <span className={twMerge("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded", isArrived ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-500" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400")}>
                                    {order.status}
                                </span>
                                <span className="text-xs text-zinc-400 font-medium">
                                    {new Date(order.created_at).toLocaleDateString()} • {order.supplier_name || 'Local Shop'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT COL: Financials */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-4">Cost Breakdown (MMK)</span>

                            <CostRow label="Total Goods Cost" value={order.total_goods_cost} />
                            <CostRow label="Supplier Service Fee" value={order.supplier_fee} />

                            {order.cargo_fee > 0 && <CostRow label="Cargo Fee" value={order.cargo_fee} />}
                            {order.local_deli_fee > 0 && <CostRow label="Local Delivery" value={order.local_deli_fee} />}
                            {order.adjustment_amount && order.adjustment_amount !== 0 && (
                                <CostRow label={`Adjustment (${order.adjustment_reason})`} value={order.adjustment_amount} />
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

                        {!isArrived && (
                            <div>
                                {!isReceivingMode ? (
                                    <Button onClick={() => setIsReceivingMode(true)} className="w-full h-14 tracking-widest uppercase font-bold text-sm">
                                        RECEIVE BATCH (MARK ARRIVED)
                                    </Button>
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

                    {/* RIGHT COL: Items */}
                    <div className="lg:col-span-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest block mb-4">Items ({order.items?.length || 0})</span>

                        <div className="flex flex-col border border-zinc-100 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-black">
                            {order.items?.map((item) => (
                                <div key={item.id} className="p-4 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 flex justify-between items-center">
                                    <div className="flex-1 mr-4">
                                        <h4 className="font-bold text-black dark:text-white text-base mb-1">{item.product.name}</h4>
                                        <span className="text-xs text-zinc-500">
                                            {item.quantity} units @ {formatMMK(item.unit_cost)} (Rate: {order.exchange_rate})
                                        </span>
                                    </div>
                                    <span className="font-black text-black dark:text-white text-lg">
                                        {formatMMK(item.line_total)}
                                    </span>
                                </div>
                            ))}
                            {(!order.items || order.items.length === 0) && (
                                <div className="p-8 flex justify-center text-zinc-400 text-sm">No items found.</div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </AppLayout>
    );
}
