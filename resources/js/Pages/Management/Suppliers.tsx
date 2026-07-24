import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, useForm, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { router } from '@inertiajs/react';
import { PaginatedData } from '@/types/pagination';
import Pagination from '@/components/Pagination';

interface Supplier {
    id: number;
    name: string;
    type: 'local' | 'foreign';
    currency: string;
    contact: string;
}

export default function Suppliers({ suppliers, showForeignOptions = true }: { suppliers: PaginatedData<Supplier>, showForeignOptions: boolean }) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<Supplier | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        name: '',
        contact: '',
        type: 'local',
        currency: 'MMK'
    });

    const openAdd = () => {
        reset();
        setIsAddOpen(true);
    };

    const openEdit = (item: Supplier) => {
        setData({
            name: item.name,
            contact: item.contact || '',
            type: item.type || 'local',
            currency: item.currency || 'MMK'
        });
        setEditItem(item);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editItem) {
            put(`/management/suppliers/${editItem.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditItem(null);
                    reset();
                    clearErrors();
                }
            });
        } else {
            post('/management/suppliers', {
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
            router.delete(`/management/suppliers/${deleteId}`, {
                preserveScroll: true,
                onSuccess: () => setDeleteId(null)
            });
        }
    };

    return (
        <AppLayout title="Suppliers">
            <Head title="Manage Suppliers" />

            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div className="flex flex-col gap-6 w-full min-w-0">
                        <h1 className="text-3xl font-black text-black dark:text-white tracking-tight shrink-0">Management</h1>
                        <div className="flex gap-4 sm:gap-6 w-full overflow-x-auto no-scrollbar pb-[17px] -mb-[17px]">
                            <Link href="/management/suppliers" className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-black dark:text-white border-b-2 border-black dark:border-white pb-4">Suppliers</Link>
                            <Link href="/management/couriers" className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white pb-4 transition-colors">Couriers</Link>
                            <Link href="/management/categories" className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white pb-4 transition-colors">Categories</Link>
                            <Link href="/management/expenses" className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white pb-4 transition-colors">Other Expenses</Link>
                            <Link href="/management/payment-methods" className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white pb-4 transition-colors">Payment Methods</Link>
                        </div>
                    </div>
                    <Button onClick={openAdd} className="uppercase tracking-widest text-[10px] font-bold px-4 py-2 h-9 mb-1 shrink-0 mt-2 sm:mt-0">
                        + New Supplier
                    </Button>
                </div>

                <div className="flex flex-col">
                    {suppliers.data.length === 0 ? (
                        <EmptyState 
                            title="No Suppliers Found" 
                            description="You haven't added any suppliers yet." 
                        />
                    ) : (
                        suppliers.data.map((item) => (
                            <div key={item.id} className="py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center px-4 -mx-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                <div>
                                    <span className="text-base font-bold text-black dark:text-white block">{item.name}</span>
                                    {item.contact && <span className="text-xs text-zinc-400 mt-1 block">{item.contact}</span>}
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-lg">
                                        <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase">{item.currency}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(item)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-2 py-1 rounded hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white transition-colors">EDIT</button>
                                        <button onClick={() => setDeleteId(item.id)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-2 py-1 rounded hover:border-red-200 dark:hover:border-red-900/50 hover:text-red-600 dark:hover:text-red-500 transition-colors">DELETE</button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <Pagination meta={suppliers} />
            </div>

            <Dialog open={isAddOpen || !!editItem} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); setEditItem(null); reset(); clearErrors(); } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Edit Supplier' : 'New Supplier'}</DialogTitle>
                        <DialogDescription>{editItem ? 'Update supplier directory details.' : 'Add a new supplier to your directory.'}</DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6 mt-4">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label>Supplier Name</Label>
                                <Input value={data.name} onChange={e => { setData('name', e.target.value); clearErrors('name'); }} placeholder="e.g. Supplier A" />
                                {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <Label>Contact Info (Optional)</Label>
                                <Input value={data.contact} onChange={e => { setData('contact', e.target.value); clearErrors('contact'); }} placeholder="e.g. Phone or WeChat" />
                            </div>

                            {showForeignOptions && (
                                <>
                                    <div className="flex flex-col gap-2 mt-2">
                                        <Label>Type</Label>
                                        <Select value={data.type} onValueChange={(val) => { if (val) { setData('type', val as 'local' | 'foreign'); if (val === 'local') setData('currency', 'MMK'); } }}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="local">Local (Myanmar)</SelectItem>
                                                <SelectItem value="foreign">Foreign (Import)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {data.type === 'foreign' && (
                                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                                            <Label>Currency</Label>
                                            <Select value={data.currency} onValueChange={val => { if (val) setData('currency', val) }}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="CNY">CNY (Yuan)</SelectItem>
                                                    <SelectItem value="THB">THB (Baht)</SelectItem>
                                                    <SelectItem value="USD">USD (Dollar)</SelectItem>
                                                    <SelectItem value="MMK">MMK (Kyat)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <Button type="submit" disabled={processing} className="w-full mt-2 font-bold tracking-widest uppercase">
                            {processing ? "Saving..." : (editItem ? "Save Changes" : "Create Supplier")}
                        </Button>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Supplier?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this supplier? If it is linked to any purchase orders, deletion will fail.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="destructive" onClick={handleDelete} className="w-full">
                            YES, DELETE SUPPLIER
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
