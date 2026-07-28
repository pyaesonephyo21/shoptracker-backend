import React, { useState, useMemo } from 'react';
import AppLayout from '@/Layouts/AppLayout';
import { Head, useForm, router } from '@inertiajs/react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface UnsettledOrder {
    id: number;
    date: string;
    customer_name: string;
    net_revenue: number;
    paid_amount: number;
    balance: number;
}

interface Props {
    couriers: { id: number; name: string }[];
    paymentMethods: { code: string; name: string }[];
    unsettledOrders: UnsettledOrder[];
    selectedCourierId: number | null;
}

export default function CourierSettlements({ couriers, paymentMethods, unsettledOrders, selectedCourierId }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        order_ids: [] as number[],
        payment_method: paymentMethods.length > 0 ? paymentMethods[0].code : ''
    });

    const handleCourierChange = (id: string | null) => {
        if (!id) return;
        router.get('/sales/settlements', { courier_id: id }, { preserveState: true });
        // Reset selected orders when courier changes
        setData('order_ids', []);
    };

    // Auto-select all when unsettledOrders load (if currently empty)
    React.useEffect(() => {
        if (unsettledOrders.length > 0) {
            setData('order_ids', unsettledOrders.map(o => o.id));
        } else {
            setData('order_ids', []);
        }
    }, [unsettledOrders]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setData('order_ids', unsettledOrders.map(o => o.id));
        } else {
            setData('order_ids', []);
        }
    };

    const handleSelectOrder = (id: number, checked: boolean) => {
        if (checked) {
            setData('order_ids', [...data.order_ids, id]);
        } else {
            setData('order_ids', data.order_ids.filter(orderId => orderId !== id));
        }
    };

    const totalSelectedAmount = useMemo(() => {
        return unsettledOrders
            .filter(o => data.order_ids.includes(o.id))
            .reduce((sum, order) => sum + order.balance, 0);
    }, [data.order_ids, unsettledOrders]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/sales/settlements', {
            onSuccess: () => {
                setData('order_ids', []);
            }
        });
    };

    return (
        <AppLayout title="Courier Batch Settlement">
            <Head title="Batch Settlement" />

            <div className="flex flex-col gap-6 sm:gap-8 pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">
                        Batch Settlement
                    </h1>
                    <p className="text-xs text-zinc-500 mt-1">Settle multiple deliveries from a courier at once</p>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm">
                    <div className="mb-6">
                        <Label className="text-[10px] uppercase text-zinc-500 font-bold mb-2 block">Select Courier</Label>
                        <Select 
                            value={selectedCourierId ? selectedCourierId.toString() : undefined} 
                            onValueChange={handleCourierChange}
                        >
                            <SelectTrigger className="w-full sm:w-[300px] h-10 font-bold bg-zinc-50 dark:bg-zinc-950">
                                {selectedCourierId ? couriers.find(c => c.id === selectedCourierId)?.name : <span className="text-zinc-400">Choose a courier...</span>}
                            </SelectTrigger>
                            <SelectContent>
                                {couriers.map(courier => (
                                    <SelectItem key={courier.id} value={courier.id.toString()}>{courier.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedCourierId ? (
                        unsettledOrders.length === 0 ? (
                            <div className="text-center py-10 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                                <p className="text-sm font-bold text-zinc-400">This courier has no unsettled deliveries!</p>
                            </div>
                        ) : (
                            <form onSubmit={submit} className="flex flex-col gap-6">
                                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden overflow-x-auto">
                                    <table className="w-full text-left text-sm whitespace-nowrap min-w-[500px]">
                                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                                            <tr>
                                                <th className="px-4 py-3 w-10">
                                                    <Checkbox 
                                                        checked={data.order_ids.length === unsettledOrders.length && unsettledOrders.length > 0}
                                                        onCheckedChange={handleSelectAll}
                                                    />
                                                </th>
                                                <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500">Order ID</th>
                                                <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500">Date</th>
                                                <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500">Customer</th>
                                                <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500 text-right">Owed Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                            {unsettledOrders.map(order => (
                                                <tr key={order.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                                    <td className="px-4 py-3">
                                                        <Checkbox 
                                                            checked={data.order_ids.includes(order.id)}
                                                            onCheckedChange={(checked) => handleSelectOrder(order.id, checked as boolean)}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 font-bold">#{order.id}</td>
                                                    <td className="px-4 py-3 text-zinc-500">{order.date}</td>
                                                    <td className="px-4 py-3">{order.customer_name || 'Walk-in'}</td>
                                                    <td className="px-4 py-3 font-black text-right text-orange-600 dark:text-orange-500">
                                                        {Math.round(order.balance).toLocaleString()} MMK
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="bg-orange-50 dark:bg-orange-950/20 border-2 border-orange-200 dark:border-orange-900/50 p-4 sm:p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-orange-600 dark:text-orange-500 uppercase tracking-widest">Total to Settle</p>
                                        <p className="text-2xl sm:text-4xl font-black text-orange-600 dark:text-orange-500 mt-1">
                                            {Math.round(totalSelectedAmount).toLocaleString()} MMK
                                        </p>
                                        <p className="text-xs text-orange-600/70 dark:text-orange-500/70 font-medium mt-1">
                                            {data.order_ids.length} orders selected
                                        </p>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 w-full sm:w-auto">
                                        <div className="flex flex-col gap-1 w-full sm:w-[200px]">
                                            <Label className="text-[10px] uppercase text-orange-700/70 dark:text-orange-400/70 font-bold ml-1">Received Into</Label>
                                            <Select 
                                                value={data.payment_method || undefined} 
                                                onValueChange={(val) => setData('payment_method', val || '')}
                                            >
                                                <SelectTrigger className="w-full h-12 bg-white dark:bg-zinc-950 border-orange-200 dark:border-orange-900 font-bold text-sm">
                                                    {data.payment_method ? paymentMethods.find(m => m.code === data.payment_method)?.name : "Select Method"}
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {paymentMethods.map(method => (
                                                        <SelectItem key={method.code} value={method.code}>{method.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        <button
                                            type="submit"
                                            disabled={processing || data.order_ids.length === 0}
                                            className="w-full sm:w-auto h-12 px-8 bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-sm disabled:opacity-50 disabled:active:scale-100"
                                        >
                                            {processing ? 'Processing...' : 'Settle Now'}
                                        </button>
                                    </div>
                                </div>
                                {errors.order_ids && <p className="text-red-500 text-xs font-bold">{errors.order_ids}</p>}
                                {errors.payment_method && <p className="text-red-500 text-xs font-bold">{errors.payment_method}</p>}
                            </form>
                        )
                    ) : null}
                </div>
            </div>
        </AppLayout>
    );
}
