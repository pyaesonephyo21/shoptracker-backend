import React, { useMemo } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { twMerge } from 'tailwind-merge';

interface Courier {
    id: number;
    name: string;
}

export default function EditSale({ order, couriers = [] }: { order: any, couriers: Courier[] }) {
    const { data, setData, put, processing, errors, transform, clearErrors } = useForm<{
        customer_name: string;
        customer_phone: string;
        address: string;
        discount_type: string;
        discount_value: string | number;
        discount_reason: string;
        extra_fee: string | number;
        overcharge: string | number;
        note: string;
        delivery_note: string;
        paid_amount: string | number;
        courier_id: string;
        tracking_number: string;
        delivery_fee: string | number;
        courier_service_fee: string | number;
    }>({
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        address: order.delivery_address || '',
        discount_type: order.discount_type || 'none',
        discount_value: order.discount_value || '',
        discount_reason: order.discount_reason || '',
        extra_fee: order.extra_fee || '',
        overcharge: order.overcharge || '',
        note: order.note || '',
        delivery_note: order.delivery_note || '',
        paid_amount: order.paid_amount || '',
        courier_id: order.courier_id ? String(order.courier_id) : 'none',
        tracking_number: order.tracking_number || '',
        delivery_fee: order.delivery_fee || '',
        courier_service_fee: order.courier_service_fee || ''
    });

    // Subtotal from existing items (cannot be edited)
    const subtotal = useMemo(() => {
        return order.items.reduce((sum: number, item: any) => {
            const qty = Number(item.quantity) || 0;
            const discountVal = Number(item.discount_value) || 0;
            const basePrice = Number(item.unit_price) || 0;

            let effectivePrice = basePrice;
            if (item.discount_type === 'fixed') {
                effectivePrice = Math.max(0, effectivePrice - discountVal);
            } else if (item.discount_type === 'percent') {
                effectivePrice = Math.max(0, effectivePrice * (1 - discountVal / 100));
            }
            return sum + (effectivePrice * qty);
        }, 0);
    }, [order.items]);

    const orderDiscountAmount = useMemo(() => {
        const val = Number(data.discount_value) || 0;
        if (data.discount_type === 'fixed') return val;
        if (data.discount_type === 'percent') return subtotal * (val / 100);
        return 0;
    }, [subtotal, data.discount_type, data.discount_value]);

    const grandTotal = Math.max(0, subtotal - orderDiscountAmount + Number(data.extra_fee || 0) + Number(data.overcharge || 0) + Number(data.delivery_fee || 0));

    const isCourier = order.delivery?.collected_by === 'courier';
    const targetTotal = isCourier
        ? grandTotal - Number(data.delivery_fee || 0) - Number(data.courier_service_fee || 0)
        : grandTotal;

    const paidNum = Number(data.paid_amount) || 0;
    const remaining = targetTotal - paidNum;
    const isOverpaid = paidNum > targetTotal + 0.1;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        transform((currentData) => ({
            ...currentData,
            courier_id: currentData.courier_id === 'none' ? null : currentData.courier_id
        }));

        put(`/sales/${order.id}`, {
            preserveScroll: true,
            onError: (err) => {
                if (Object.keys(err).length === 0) {
                    alert('Failed to update order');
                }
            }
        });
    };

    return (
        <AppLayout title="Edit Sale">
            <Head title={`Edit Order #${order.id}`} />

            <div className="flex flex-col max-w-4xl mx-auto w-full">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 mb-8 flex justify-between items-center">
                    <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                        Edit Order #{order.id}
                    </h1>
                    <button
                        type="button"
                        onClick={() => router.visit(`/sales/${order.id}`)}
                        className="text-zinc-500 font-bold hover:text-black dark:hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 mb-8 text-yellow-800 dark:text-yellow-200 text-sm font-medium flex gap-3 items-center">
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>To protect inventory accuracy, the items and quantities cannot be edited. If they are incorrect, please cancel the order and create a new one.</span>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-10 pb-20">

                    {/* 1. Customer */}
                    <section>
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 dark:text-zinc-400">
                            01. Customer
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="customer_name">Name (Optional)</Label>
                                <Input
                                    id="customer_name"
                                    value={data.customer_name}
                                    onChange={(e) => { setData('customer_name', e.target.value); clearErrors('customer_name'); }}
                                />
                                {errors.customer_name && <span className="text-red-500 text-xs">{errors.customer_name}</span>}
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="customer_phone">Phone (Optional)</Label>
                                <Input
                                    id="customer_phone"
                                    type="tel"
                                    value={data.customer_phone}
                                    onChange={(e) => { setData('customer_phone', e.target.value); clearErrors('customer_phone'); }}
                                />
                                {errors.customer_phone && <span className="text-red-500 text-xs">{errors.customer_phone}</span>}
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="address">Address (Optional)</Label>
                            <textarea
                                id="address"
                                value={data.address}
                                onChange={(e) => { setData('address', e.target.value); clearErrors('address'); }}
                                className="flex min-h-[80px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300 resize-y"
                            />
                            {errors.address && <span className="text-red-500 text-xs">{errors.address}</span>}
                        </div>
                    </section>

                    {/* 2. Products (Read Only) */}
                    <section>
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 dark:text-zinc-400">
                            02. Products (Read Only)
                        </h2>

                        <div className="flex flex-col gap-4">
                            {order.items.map((item: any, index: number) => {
                                const productName = item.product_variant ? `${item.product_variant.product?.name} - ${Object.values(item.product_variant.attributes || {}).join(' / ') || 'Default'}` : (item.product?.name || `Item #${index + 1}`);
                                const price = Number(item.unit_price) || 0;
                                const qty = Number(item.quantity) || 0;
                                const discountVal = Number(item.discount_value) || 0;

                                let effectivePrice = price;
                                if (item.discount_type === 'fixed') effectivePrice -= discountVal;
                                else if (item.discount_type === 'percent') effectivePrice *= (1 - discountVal / 100);

                                return (
                                    <div key={item.id} className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex flex-col md:flex-row gap-4 relative opacity-80">
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-lg">{productName}</h3>
                                            </div>
                                            <div className="text-zinc-500 text-sm">
                                                {qty} x {effectivePrice.toLocaleString()} MMK
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* 3. Delivery (Only visible if order status is delivery_added) */}
                    {order.status === 'delivery_added' && (
                        <section>
                            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 dark:text-zinc-400">
                                Delivery Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex flex-col gap-2">
                                    <Label>Courier</Label>
                                    <Select value={data.courier_id} onValueChange={(val) => setData('courier_id', val || 'none')}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a courier...">
                                                {data.courier_id === 'none'
                                                    ? 'None'
                                                    : (couriers.find(c => String(c.id) === data.courier_id)?.name || "Select a courier...")}
                                            </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {couriers.map(c => (
                                                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>Tracking Number</Label>
                                    <Input
                                        value={data.tracking_number}
                                        onChange={(e) => { setData('tracking_number', e.target.value); clearErrors('tracking_number'); }}
                                        placeholder="e.g. TRK12345"
                                    />
                                    {errors.tracking_number && <span className="text-red-500 text-xs">{errors.tracking_number}</span>}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>Delivery Fee (Charged to Customer)</Label>
                                    <FormattedNumberInput
                                        value={data.delivery_fee}
                                        onChange={(val) => { setData('delivery_fee', val); clearErrors('delivery_fee'); }}
                                    />
                                    {errors.delivery_fee && <span className="text-red-500 text-xs">{errors.delivery_fee}</span>}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>Courier Overcharge</Label>
                                    <FormattedNumberInput
                                        value={data.overcharge}
                                        onChange={(val) => { setData('overcharge', val); clearErrors('overcharge'); }}
                                    />
                                    {errors.overcharge && <span className="text-red-500 text-xs">{errors.overcharge}</span>}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>Courier Service Fee (Cost to Shop)</Label>
                                    <FormattedNumberInput
                                        value={data.courier_service_fee}
                                        onChange={(val) => { setData('courier_service_fee', val); clearErrors('courier_service_fee'); }}
                                    />
                                    {errors.courier_service_fee && <span className="text-red-500 text-xs">{errors.courier_service_fee}</span>}
                                </div>
                                <div className="flex flex-col gap-2 md:col-span-2">
                                    <Label htmlFor="delivery_note">Delivery Note (Optional)</Label>
                                    <textarea
                                        id="delivery_note"
                                        placeholder="Optional instructions for delivery..."
                                        value={data.delivery_note}
                                        onChange={(e) => { setData('delivery_note', e.target.value); clearErrors('delivery_note'); }}
                                        className="flex min-h-[80px] w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus-visible:ring-zinc-300 resize-y"
                                    />
                                    {errors.delivery_note && <span className="text-red-500 text-xs">{errors.delivery_note}</span>}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* 4. Payment & Totals */}
                    <section>
                        <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6 dark:text-zinc-400">
                            03. Payment
                        </h2>

                        <div className="p-6 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-zinc-500 text-sm font-medium">Subtotal (After Item Disc.)</span>
                                <span className="text-black dark:text-white font-bold text-sm">{subtotal.toLocaleString()}</span>
                            </div>

                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-4">
                                    <span className="text-zinc-500 text-sm font-medium">Extra Discount</span>
                                    <div className="flex bg-zinc-200 dark:bg-zinc-800 rounded-lg p-1">
                                        <button type="button" onClick={() => setData('discount_type', data.discount_type === 'fixed' ? 'none' : 'fixed')} className={twMerge("px-3 py-1 rounded text-[10px] font-bold", data.discount_type === 'fixed' ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "text-zinc-500")}>$</button>
                                        <button type="button" onClick={() => setData('discount_type', data.discount_type === 'percent' ? 'none' : 'percent')} className={twMerge("px-3 py-1 rounded text-[10px] font-bold", data.discount_type === 'percent' ? "bg-white dark:bg-zinc-700 text-black dark:text-white shadow-sm" : "text-zinc-500")}>%</button>
                                    </div>
                                </div>
                                <span className="text-green-600 dark:text-green-400 font-bold text-sm">-{orderDiscountAmount.toLocaleString()}</span>
                            </div>

                            {data.discount_type !== 'none' && (
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <FormattedNumberInput
                                        placeholder="Discount Value"
                                        value={data.discount_value}
                                        onChange={(val) => { setData('discount_value', val); clearErrors('discount_value'); }}
                                    />
                                    {errors.discount_value && <span className="text-red-500 text-xs">{errors.discount_value}</span>}
                                    <Input
                                        placeholder="Reason"
                                        value={data.discount_reason}
                                        onChange={(e) => { setData('discount_reason', e.target.value); clearErrors('discount_reason'); }}
                                    />
                                    {errors.discount_reason && <span className="text-red-500 text-xs">{errors.discount_reason}</span>}
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-4 mb-2">
                                <span className="text-zinc-500 text-sm font-medium">Extra Fee (e.g. KPay %)</span>
                                <FormattedNumberInput
                                    placeholder="0"
                                    value={data.extra_fee}
                                    onChange={(val) => { setData('extra_fee', val); clearErrors('extra_fee'); }}
                                    className="w-32 h-8 text-right font-bold"
                                />
                                {errors.extra_fee && <span className="text-red-500 text-xs">{errors.extra_fee}</span>}
                            </div>

                            <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-4" />

                            <div className="flex justify-between items-center">
                                <span className="text-black dark:text-white text-lg font-black uppercase">Grand Total</span>
                                <span className="text-black dark:text-white text-2xl font-black">
                                    {grandTotal.toLocaleString()} <span className="text-xs font-bold text-zinc-400">MMK</span>
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                            <div className="bg-black dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
                                <span className="text-zinc-400 text-xs font-bold uppercase block mb-3">Deposit / Paid</span>
                                <FormattedNumberInput
                                    value={data.paid_amount}
                                    onChange={(val) => { setData('paid_amount', val); clearErrors('paid_amount'); }}
                                    placeholder="0"
                                    className="bg-transparent shadow-none border-none outline-none text-white font-black text-2xl w-full h-auto px-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                                {errors.paid_amount && <span className="text-red-500 text-xs">{errors.paid_amount}</span>}
                            </div>

                            <div className="flex flex-col items-end justify-center py-4">
                                {isOverpaid ? (
                                    <>
                                        <span className="text-[10px] text-red-500 uppercase font-black">Error</span>
                                        <span className="text-red-500 font-bold text-lg">Overpaid</span>
                                    </>
                                ) : remaining > 0 ? (
                                    <>
                                        <span className="text-[10px] text-zinc-400 uppercase font-bold">Remaining</span>
                                        <span className="text-orange-500 font-black text-2xl">{remaining.toLocaleString()} MMK</span>
                                    </>
                                ) : (
                                    <div className="bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-xl border border-green-200 dark:border-green-800">
                                        <span className="text-green-700 dark:text-green-400 text-sm font-black">✓ Fully Paid</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </section>

                    <section className="flex flex-col gap-2">
                        <Label htmlFor="note">General Note (Optional)</Label>
                        <Input
                            id="note"
                            placeholder="Optional..."
                            value={data.note}
                            onChange={(e) => { setData('note', e.target.value); clearErrors('note'); }}
                        />
                        {errors.note && <span className="text-red-500 text-xs">{errors.note}</span>}
                    </section>

                    <Button
                        type="submit"
                        disabled={processing}
                        className="w-full mt-4 h-12 text-sm font-bold tracking-wide"
                    >
                        {processing ? "SAVING..." : "SAVE CHANGES"}
                    </Button>
                </form>
            </div>
        </AppLayout>
    );
}
