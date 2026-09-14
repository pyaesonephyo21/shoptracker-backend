import React from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SalesOrder } from '@/types/sales';
import { twMerge } from 'tailwind-merge';

interface Courier {
    id: number;
    name: string;
    contact_info?: string;
    default_service_fee: number;
    default_overcharge: number;
}

export default function FulfillOrder({ order, couriers = [] }: { order: SalesOrder, couriers: Courier[] }) {
    const isPrepaid = (order.financials?.paid_amount || 0) > 0;

    const { data, setData, post, processing, errors, clearErrors } = useForm({
        courier_id: '',
        tracking_number: order.delivery?.tracking || '',
        delivery_fee: order.delivery?.fee ? String(order.delivery.fee) : '',
        courier_service_fee: order.delivery?.courier_service_fee ? String(order.delivery.courier_service_fee) : '',
        overcharge: order.financials?.overcharge ? String(order.financials.overcharge) : '',
        delivery_note: order.delivery?.note || order.note || '',
        money_collected_by: (order.delivery?.collected_by || (isPrepaid ? 'seller' : 'courier')) as 'seller' | 'courier',
        is_deli_prepaid: Boolean(order.delivery?.is_prepaid ?? isPrepaid)
    });

    const selectedCourier = couriers.find(c => c.id === Number(data.courier_id));
    const isPickup = false;
    const isSelfManaged = false;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(`/sales/${order.id}/fulfill`, {
            preserveScroll: (page) => Object.keys(page.props.errors || {}).length > 0,
            onError: () => alert('Failed to fulfill order')
        });
    };

    return (
        <AppLayout title={`Fulfill #${order.id}`}>
            <Head title={`Fulfill Order #${order.id}`} />

            <div className="flex flex-col max-w-2xl mx-auto w-full px-4 sm:px-0 pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button type="button" onClick={() => router.visit(`/sales/${order.id}`)} className="text-zinc-500 hover:text-black dark:hover:text-white text-xl">←</button>
                        <div>
                            <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">Arrange Delivery</h1>
                            <p className="text-sm font-medium text-zinc-500">Order #{order.id}</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                    
                    {/* 1. SELECT COURIER */}
                    <div className="flex flex-col gap-2">
                        <Label>Select Method / Courier</Label>
                        <Select value={data.courier_id} onValueChange={(val) => {
                            if (!val) return;
                            const selected = couriers.find(c => c.id === Number(val));
                            setData(current => ({
                                ...current,
                                courier_id: val,
                                courier_service_fee: selected ? String(Number(selected.default_service_fee || 0)) : current.courier_service_fee,
                                overcharge: selected ? String(Number(selected.default_overcharge || 0)) : current.overcharge
                            }));
                        }}>
                            <SelectTrigger>
                                <SelectValue placeholder="Choose a courier...">
                                    {selectedCourier ? selectedCourier.name : "Choose a courier..."}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {couriers.map(c => (
                                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.courier_id && <span className="text-red-500 text-xs">{errors.courier_id}</span>}
                    </div>

                    {data.courier_id && (
                        <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-top-4 duration-300">
                            
                            {/* 2. FEES */}
                            {!isPickup && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <Label>Deli Fee (Customer)</Label>
                                        <FormattedNumberInput
                                            value={data.delivery_fee}
                                            onChange={(val) => { setData('delivery_fee', val); clearErrors('delivery_fee'); }}
                                            placeholder="e.g. 3500"
                                        />
                                        {errors.delivery_fee && <span className="text-red-500 text-xs">{errors.delivery_fee}</span>}
                                    </div>

                                    {!isSelfManaged && (
                                        <div className="flex flex-col gap-2">
                                            <Label>Overcharge (Income)</Label>
                                            <FormattedNumberInput
                                                value={data.overcharge}
                                                onChange={(val) => { setData('overcharge', val); clearErrors('overcharge'); }}
                                                placeholder="0"
                                            />
                                            {errors.overcharge && <span className="text-red-500 text-xs">{errors.overcharge}</span>}
                                        </div>
                                    )}

                                    {!isSelfManaged && (
                                        <div className="flex flex-col gap-2">
                                            <Label>Service Fee (Cost)</Label>
                                            <FormattedNumberInput
                                                value={data.courier_service_fee}
                                                onChange={(val) => { setData('courier_service_fee', val); clearErrors('courier_service_fee'); }}
                                                placeholder="0"
                                            />
                                            {errors.courier_service_fee && <span className="text-red-500 text-xs">{errors.courier_service_fee}</span>}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 3. TRACKING */}
                            {!isSelfManaged && (
                                <div className="flex flex-col gap-2">
                                    <Label>Tracking No. (Optional)</Label>
                                    <Input
                                        value={data.tracking_number}
                                        onChange={(e) => { setData('tracking_number', e.target.value); clearErrors('tracking_number'); }}
                                        placeholder="e.g. TRK12345"
                                    />
                                </div>
                            )}

                            {/* 4. COLLECTION RULES */}
                            {!isSelfManaged && (
                                <div className="flex flex-col gap-4">
                                    <Label className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-800 pb-2">
                                        Payment & Delivery Scenario
                                    </Label>
                                    
                                    <div className="flex flex-col gap-3">
                                        <button
                                            type="button"
                                            onClick={() => { setData('money_collected_by', 'seller'); setData('is_deli_prepaid', true); }}
                                            className={twMerge("p-4 rounded-xl border-2 text-left transition-all", 
                                                data.money_collected_by === 'seller' && data.is_deli_prepaid ? "border-black bg-zinc-50 dark:border-white dark:bg-zinc-900" : "border-zinc-200 bg-transparent text-zinc-500 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700")}
                                        >
                                            <span className={twMerge("block font-bold text-sm mb-1", data.money_collected_by === 'seller' && data.is_deli_prepaid ? "text-black dark:text-white" : "")}>
                                                Fully Prepaid (Deli Included)
                                            </span>
                                            <span className="text-xs text-zinc-500">Customer paid us for everything (items + deli fee). Shop pays courier.</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => { setData('money_collected_by', 'seller'); setData('is_deli_prepaid', false); }}
                                            className={twMerge("p-4 rounded-xl border-2 text-left transition-all", 
                                                data.money_collected_by === 'seller' && !data.is_deli_prepaid ? "border-black bg-zinc-50 dark:border-white dark:bg-zinc-900" : "border-zinc-200 bg-transparent text-zinc-500 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700")}
                                        >
                                            <span className={twMerge("block font-bold text-sm mb-1", data.money_collected_by === 'seller' && !data.is_deli_prepaid ? "text-black dark:text-white" : "")}>
                                                Items Prepaid (Deli Separate)
                                            </span>
                                            <span className="text-xs text-zinc-500">Customer paid us for items. Customer pays delivery fee to courier.</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => { 
                                                const selected = couriers.find(c => c.id === Number(data.courier_id));
                                                setData(current => ({
                                                    ...current,
                                                    money_collected_by: 'courier',
                                                    is_deli_prepaid: false,
                                                    overcharge: selected ? String(Number(selected.default_overcharge || 0)) : current.overcharge
                                                }));
                                            }}
                                            className={twMerge("p-4 rounded-xl border-2 text-left transition-all", 
                                                data.money_collected_by === 'courier' ? "border-black bg-zinc-50 dark:border-white dark:bg-zinc-900" : "border-zinc-200 bg-transparent text-zinc-500 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700")}
                                        >
                                            <span className={twMerge("block font-bold text-sm mb-1", data.money_collected_by === 'courier' ? "text-black dark:text-white" : "")}>
                                                COD (Courier Collects All)
                                            </span>
                                            <span className="text-xs text-zinc-500">Customer pays items & delivery fee to the courier in cash.</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 5. NOTE */}
                            <div className="flex flex-col gap-2">
                                <Label>Delivery Instructions (Optional)</Label>
                                <Input
                                    value={data.delivery_note}
                                    onChange={(e) => { setData('delivery_note', e.target.value); clearErrors('delivery_note'); }}
                                    placeholder="e.g. Call before arrival..."
                                />
                            </div>

                            <div className="pt-4 mt-4 border-t border-zinc-100 dark:border-zinc-800">
                                <Button type="submit" disabled={processing} className="w-full h-14 text-sm tracking-widest font-bold">
                                    {processing ? "PROCESSING..." : "CONFIRM & SHIP"}
                                </Button>
                            </div>

                        </div>
                    )}
                </form>
            </div>
        </AppLayout>
    );
}
