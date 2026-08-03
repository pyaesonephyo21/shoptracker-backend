import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';

import { PaginatedData } from '@/types/pagination';
import Pagination from '@/components/Pagination';
import ManagementHeader from '@/components/ManagementHeader';

interface Courier {
    id: number;
    name: string;
    contact_info: string;
    default_service_fee: number;
    default_overcharge: number;
}

export default function Couriers({ couriers }: { couriers: PaginatedData<Courier> }) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<Courier | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: '',
        contact: '',
        default_fee: '',
        default_overcharge: ''
    });

    const openAdd = () => {
        reset();
        setIsAddOpen(true);
    };

    const openEdit = (item: Courier) => {
        setData({
            name: item.name,
            contact: item.contact_info || '',
            default_fee: item.default_service_fee ? item.default_service_fee.toString() : '',
            default_overcharge: item.default_overcharge ? item.default_overcharge.toString() : ''
        });
        setEditItem(item);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editItem) {
            put(`/management/couriers/${editItem.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditItem(null);
                    reset();
                    clearErrors();
                }
            });
        } else {
            post('/management/couriers', {
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
            router.delete(`/management/couriers/${deleteId}`, {
                preserveScroll: true,
                onSuccess: () => setDeleteId(null)
            });
        }
    };

    return (
        <AppLayout title="Couriers">
            <Head title="Manage Couriers" />

            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20">
                <ManagementHeader>
                    <Button onClick={openAdd} className="uppercase tracking-widest text-[10px] font-bold px-4 py-2 h-9">
                        + New Courier
                    </Button>
                </ManagementHeader>

                <div className="flex flex-col">
                    {couriers.data.length === 0 ? (
                        <EmptyState 
                            title="No Couriers Found" 
                            description="You haven't added any delivery partners yet." 
                        />
                    ) : (
                        couriers.data.map((item) => (
                            <div key={item.id} className="py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center px-4 -mx-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                <div>
                                    <span className="text-base font-bold text-black dark:text-white block">{item.name}</span>
                                    {item.contact_info && <span className="text-xs text-zinc-400 mt-1 block">{item.contact_info}</span>}
                                </div>
                                <div className="flex items-center gap-4">
                                    {item.default_service_fee > 0 && (
                                        <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                                            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Fee: {item.default_service_fee}</span>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(item)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-2 py-1 rounded hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white transition-colors">EDIT</button>
                                        <button onClick={() => setDeleteId(item.id)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-2 py-1 rounded hover:border-red-200 dark:hover:border-red-900/50 hover:text-red-600 dark:hover:text-red-500 transition-colors">DELETE</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <Pagination meta={couriers} />
            </div>

            <Dialog open={isAddOpen || !!editItem} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setEditItem(null); reset(); clearErrors(); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Edit Courier' : 'New Courier'}</DialogTitle>
                        <DialogDescription>{editItem ? 'Update courier details.' : 'Add a new delivery partner to your system.'}</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label>Courier Name</Label>
                                <Input value={data.name} onChange={e => { setData('name', e.target.value); clearErrors('name'); }} placeholder="e.g. Royal Express" />
                                {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <Label>Contact Info (Optional)</Label>
                                <Input value={data.contact} onChange={e => { setData('contact', e.target.value); clearErrors('contact'); }} placeholder="e.g. 09..." />
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <div className="flex flex-col gap-2">
                                    <Label>Default Service Fee</Label>
                                    <FormattedNumberInput value={data.default_fee} onChange={(val) => { setData('default_fee', val); clearErrors('default_fee'); }} placeholder="e.g. 200" />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Label>Default Overcharge</Label>
                                    <FormattedNumberInput value={data.default_overcharge} onChange={(val) => { setData('default_overcharge', val); clearErrors('default_overcharge'); }} placeholder="e.g. 500" />
                                </div>
                            </div>
                            <span className="text-xs text-zinc-400 -mt-2">Fee is what the courier charges you. Overcharge is what you charge the customer.</span>
                        </div>

                        <Button type="submit" disabled={processing} className="w-full mt-2 font-bold tracking-widest uppercase">
                            {processing ? "Saving..." : (editItem ? "Save Changes" : "Create Courier")}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Courier?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this courier? If it is linked to any sales orders, deletion will fail.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="destructive" onClick={handleDelete} className="w-full">
                            YES, DELETE COURIER
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
