import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

import { PaginatedData } from '@/types/pagination';
import Pagination from '@/components/Pagination';

interface Courier {
    id: number;
    name: string;
    contact: string;
    default_fee: number;
}

export default function Couriers({ couriers }: { couriers: PaginatedData<Courier> }) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<Courier | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        contact: '',
        default_fee: ''
    });

    const openAdd = () => {
        reset();
        setIsAddOpen(true);
    };

    const openEdit = (item: Courier) => {
        setData({
            name: item.name,
            contact: item.contact || '',
            default_fee: item.default_fee ? item.default_fee.toString() : ''
        });
        setEditItem(item);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editItem) {
            put(`/management/couriers/${editItem.id}`, {
                onSuccess: () => {
                    setEditItem(null);
                    reset();
                }
            });
        } else {
            post('/management/couriers', {
                onSuccess: () => {
                    setIsAddOpen(false);
                    reset();
                }
            });
        }
    };

    const handleDelete = () => {
        if (deleteId) {
            router.delete(`/management/couriers/${deleteId}`, {
                onSuccess: () => setDeleteId(null)
            });
        }
    };

    return (
        <AppLayout title="Couriers">
            <Head title="Manage Couriers" />

            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div className="flex flex-col gap-6 w-full overflow-x-auto no-scrollbar">
                        <h1 className="text-3xl font-black text-black dark:text-white tracking-tight shrink-0">Management.</h1>
                        <div className="flex gap-4 sm:gap-6 -mb-[17px] min-w-max">
                            <Link href="/management/suppliers" className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white pb-4 transition-colors">Suppliers</Link>
                            <Link href="/management/couriers" className="text-xs font-bold uppercase tracking-widest text-black dark:text-white border-b-2 border-black dark:border-white pb-4">Couriers</Link>
                            <Link href="/management/categories" className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white pb-4 transition-colors">Categories</Link>
                        </div>
                    </div>
                    <Button onClick={openAdd} className="uppercase tracking-widest text-[10px] font-bold px-4 py-2 h-9 mb-1 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                        + New Courier
                    </Button>
                </div>

                <div className="flex flex-col">
                    {couriers.data.length === 0 ? (
                        <div className="mt-10 flex justify-center items-center p-10 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50">
                            <span className="text-zinc-400 font-medium">No couriers found.</span>
                        </div>
                    ) : (
                        couriers.data.map((item) => (
                            <div key={item.id} className="py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center px-4 -mx-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                <div>
                                    <span className="text-base font-bold text-black dark:text-white block">{item.name}</span>
                                    {item.contact && <span className="text-xs text-zinc-400 mt-1 block">{item.contact}</span>}
                                </div>
                                <div className="flex items-center gap-4">
                                    {item.default_fee > 0 && (
                                        <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                                            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">Fee: {item.default_fee}</span>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(item)} className="text-[10px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">EDIT</button>
                                        <button onClick={() => setDeleteId(item.id)} className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">DELETE</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <Pagination meta={couriers} />
            </div>

            <Dialog open={isAddOpen || !!editItem} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setEditItem(null); reset(); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Edit Courier' : 'New Courier'}</DialogTitle>
                        <DialogDescription>{editItem ? 'Update courier details.' : 'Add a new delivery partner to your system.'}</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label>Courier Name</Label>
                                <Input value={data.name} onChange={e => setData('name', e.target.value)} required placeholder="e.g. Royal Express" />
                                {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <Label>Contact Info</Label>
                                <Input value={data.contact} onChange={e => setData('contact', e.target.value)} placeholder="e.g. 09..." />
                            </div>

                            <div className="flex flex-col gap-2 mt-4">
                                <Label>Default Service Fee (MMK)</Label>
                                <Input type="number" value={data.default_fee} onChange={e => setData('default_fee', e.target.value)} placeholder="0" />
                                <span className="text-xs text-zinc-400 -mt-1">Commonly used for services like Wepozt (200 MMK)</span>
                            </div>
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
