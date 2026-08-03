import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import ManagementHeader from '@/components/ManagementHeader';
import { twMerge } from 'tailwind-merge';

interface PaymentMethod {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
}

export default function PaymentMethods({ auth, paymentMethods }: { auth: any, paymentMethods: PaymentMethod[] }) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<PaymentMethod | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: '',
        code: '',
        is_active: true,
    });

    const openAdd = () => {
        reset();
        setIsAddOpen(true);
    };

    const openEdit = (item: PaymentMethod) => {
        setData({
            name: item.name,
            code: item.code,
            is_active: item.is_active,
        });
        setEditItem(item);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editItem) {
            put(`/management/payment-methods/${editItem.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditItem(null);
                    reset();
                    clearErrors();
                }
            });
        } else {
            post('/management/payment-methods', {
                preserveScroll: true,
                onSuccess: () => {
                    setIsAddOpen(false);
                    reset();
                    clearErrors();
                }
            });
        }
    };

    const handleDelete = () => {
        if (deleteId) {
            router.delete(`/management/payment-methods/${deleteId}`, {
                preserveScroll: true,
                onSuccess: () => setDeleteId(null)
            });
        }
    };

    return (
        <AppLayout title="Payment Methods">
            <Head title="Manage Payment Methods" />

            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20">
                <ManagementHeader>
                    <Button onClick={openAdd} className="uppercase tracking-widest text-[10px] font-bold px-4 py-2 h-9">
                        + New Method
                    </Button>
                </ManagementHeader>

                <div className="flex flex-col">
                    {paymentMethods.length === 0 ? (
                        <EmptyState 
                            title="No Payment Methods" 
                            description="You haven't added any payment methods yet. Add options like Cash, KBZPay, AYAPay." 
                        />
                    ) : (
                        paymentMethods.map((item) => (
                            <div key={item.id} className="py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center px-4 -mx-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={twMerge("text-base font-bold block", item.is_active ? "text-black dark:text-white" : "text-zinc-400")}>{item.name}</span>
                                        {!item.is_active && (
                                            <span className="text-[9px] uppercase font-bold tracking-widest bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full">
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-zinc-400 mt-1 block">Code: <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">{item.code}</span></span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(item)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-2 py-1 rounded hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white transition-colors">EDIT</button>
                                        <button onClick={() => setDeleteId(item.id)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-2 py-1 rounded hover:border-red-200 dark:hover:border-red-900/50 hover:text-red-600 dark:hover:text-red-500 transition-colors">DELETE</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <Dialog open={isAddOpen || !!editItem} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setEditItem(null); reset(); clearErrors(); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Edit Payment Method' : 'New Payment Method'}</DialogTitle>
                        <DialogDescription>{editItem ? 'Update payment method details.' : 'Add a new payment option for your customers.'}</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label>Display Name</Label>
                                <Input value={data.name} onChange={e => { setData('name', e.target.value); clearErrors('name'); }} placeholder="e.g. KBZPay, Cash, WavePay" />
                                {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <Label>System Code</Label>
                                <Input value={data.code} onChange={e => { setData('code', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '')); clearErrors('code'); }} placeholder="e.g. kpay, cash, wavepay" />
                                <p className="text-[10px] text-zinc-500">Short unique code used in the database. Use lowercase letters, no spaces.</p>
                                {errors.code && <span className="text-red-500 text-xs">{errors.code}</span>}
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                                <input 
                                    type="checkbox" 
                                    id="is_active" 
                                    checked={data.is_active} 
                                    onChange={e => setData('is_active', e.target.checked)}
                                    className="rounded border-zinc-300 text-black focus:ring-black"
                                />
                                <Label htmlFor="is_active">Active & Available for new sales</Label>
                            </div>
                        </div>

                        <Button type="submit" disabled={processing} className="w-full mt-2 font-bold tracking-widest uppercase">
                            {processing ? "Saving..." : (editItem ? "Save Changes" : "Create Method")}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Payment Method?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this payment method? This will not affect past orders, but will prevent it from being selected in the future.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="destructive" onClick={handleDelete} className="w-full">
                            YES, DELETE METHOD
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
