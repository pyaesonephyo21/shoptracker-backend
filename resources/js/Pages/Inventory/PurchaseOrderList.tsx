import React from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { PurchaseOrder } from '@/types/inventory';
import { twMerge } from 'tailwind-merge';

export default function PurchaseOrderList({ orders = [] }: { orders: PurchaseOrder[] }) {
    return (
        <AppLayout title="Purchase Orders">
            <Head title="Purchase Orders" />

            <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <Link href="/inventory" className="text-zinc-500 hover:text-black dark:hover:text-white text-xl">←</Link>
                        <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                            Purchases.
                        </h1>
                    </div>

                    <Link
                        href="/inventory/purchase-orders/create"
                        className="bg-black dark:bg-white px-4 py-2 rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-sm"
                    >
                        <span className="text-[10px] font-bold text-white dark:text-black uppercase tracking-widest">
                            + New PO
                        </span>
                    </Link>
                </div>

                <div className="flex flex-col">
                    {orders.length === 0 ? (
                        <div className="mt-10 flex justify-center items-center p-10 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50">
                            <span className="text-zinc-400 font-medium">No purchase orders found.</span>
                        </div>
                    ) : (
                        orders.map((item) => {
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
                                            <span className="font-bold text-black dark:text-white text-base">
                                                {item.batch_name}
                                            </span>
                                            {!isArrived && (
                                                <div className="bg-black dark:bg-white px-2 py-0.5 rounded">
                                                    <span className="text-[10px] font-bold text-white dark:text-black uppercase">
                                                        Pending
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                                            {new Date(item.created_at).toLocaleDateString()} • {item.supplier_name || "Unknown Supplier"}
                                        </span>
                                    </div>

                                    <div className="flex flex-col items-end">
                                        <span className="text-sm font-bold text-black dark:text-white">
                                            {Number(item.grand_total).toLocaleString()} MMK
                                        </span>
                                        <span className={twMerge("text-[10px] font-bold uppercase tracking-widest", isPaid ? "text-green-600 dark:text-green-500" : "text-red-500")}>
                                            {item.payment_status}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
