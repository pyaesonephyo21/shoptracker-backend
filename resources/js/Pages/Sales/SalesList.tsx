import React from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, Link } from '@inertiajs/react';
import { SalesOrder } from '../../types/sales';

export default function SalesList({ orders = [] }: { orders: SalesOrder[] }) {
    const getStatusStyle = (order: SalesOrder) => {
        if (order.status.toUpperCase() === "CANCELLED") {
            return { color: "text-red-500", text: "CANCELLED" };
        }
        const payStatus = order.financials.payment_status;
        if (payStatus === "unpaid") return { color: "text-red-500 bg-red-50 dark:bg-red-900/20", text: "UNPAID" };
        if (payStatus === "partial") return { color: "text-orange-500 bg-orange-50 dark:bg-orange-900/20", text: "PARTIAL" };
        if (payStatus === "paid") return { color: "text-green-600 bg-green-50 dark:bg-green-900/20", text: "PAID" };
        return { color: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800", text: payStatus.toUpperCase() };
    };

    const getOrderStatusStyle = (status: string) => {
        const s = status.toUpperCase();
        if (s === "PENDING") return "text-zinc-500 bg-zinc-100 dark:bg-zinc-800";
        if (s === "DELIVERY ADDED") return "text-blue-600 bg-blue-50 dark:bg-blue-900/20";
        if (s === "DELIVERED") return "text-purple-600 bg-purple-50 dark:bg-purple-900/20";
        if (s === "COMPLETED") return "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20";
        if (s === "CANCELLED") return "text-red-600 bg-red-50 dark:bg-red-900/20";
        return "text-zinc-500 bg-zinc-100 dark:bg-zinc-800";
    };

    return (
        <AppLayout title="Sales">
            <Head title="Sales" />

            <div className="flex flex-col gap-6">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 flex justify-between items-center">
                    <h1 className="text-3xl font-black text-black dark:text-white tracking-tight">
                        Sales.
                    </h1>

                    <Link
                        href="/sales/create"
                        className="bg-black dark:bg-white px-4 py-2 rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-sm"
                    >
                        <span className="text-[10px] font-bold text-white dark:text-black uppercase tracking-widest">
                            + New Sale
                        </span>
                    </Link>
                </div>

                <div className="flex flex-col">
                    {orders.length === 0 ? (
                        <div className="mt-10 flex justify-center items-center">
                            <span className="text-zinc-400 font-medium">No sales found.</span>
                        </div>
                    ) : (
                        orders.map((item) => {
                            const statusStyle = getStatusStyle(item);
                            return (
                                <Link
                                    key={item.id}
                                    href={`/sales/${item.id}`}
                                    className="py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 -mx-4 px-4 rounded-xl group"
                                >
                                    <div>
                                        <div className="flex items-center mb-1">
                                            <span className="font-bold text-black dark:text-white text-base mr-2">
                                                {item.customer.name || "Walk-in Customer"}
                                            </span>
                                            <div className="flex gap-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getStatusStyle(item).color}`}>
                                                    {getStatusStyle(item).text}
                                                </span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${getOrderStatusStyle(item.status)}`}>
                                                    {item.status.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                            #{item.id} • {item.date}
                                        </span>
                                    </div>

                                    <div className="flex flex-col items-end">
                                        <span className="font-black text-black dark:text-white text-base">
                                            {Number(item.financials.paid_amount).toLocaleString()}
                                        </span>
                                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                                            MMK
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
