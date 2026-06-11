import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginatedData } from '@/types/pagination';
import Pagination from '@/components/Pagination';
import { DatePicker } from '@/components/ui/date-picker';
import { Filter } from 'lucide-react';

interface Expense {
    id: number;
    title: string;
    amount: number;
    incurred_at: string;
    category?: string;
    note?: string;
}

export default function Expenses({ expenses, filters = { start_date: '', end_date: '' } }: { expenses: PaginatedData<Expense>, filters?: { start_date: string, end_date: string } }) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<Expense | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    
    const [startDate, setStartDate] = useState<Date | undefined>(filters.start_date ? new Date(filters.start_date) : undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(filters.end_date ? new Date(filters.end_date) : undefined);
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const handleFilterChange = (start?: Date, end?: Date) => {
        router.get('/management/expenses', {
            start_date: start ? start.toISOString().split('T')[0] : undefined,
            end_date: end ? end.toISOString().split('T')[0] : undefined,
            page: 1
        }, { preserveState: true, replace: true });
    };

    const applyFilters = () => {
        handleFilterChange(startDate, endDate);
        setIsFilterOpen(false);
    };

    const clearFilters = () => {
        setStartDate(undefined);
        setEndDate(undefined);
        handleFilterChange(undefined, undefined);
        setIsFilterOpen(false);
    };

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        title: '',
        amount: '',
        incurred_at: new Date().toISOString().split('T')[0],
        category: '',
        note: ''
    });

    const openAdd = () => {
        reset();
        setIsAddOpen(true);
    };

    const openEdit = (item: Expense) => {
        setData({
            title: item.title,
            amount: item.amount.toString(),
            incurred_at: item.incurred_at.split('T')[0], // Extract just the date part if it comes as datetime
            category: item.category || '',
            note: item.note || ''
        });
        setEditItem(item);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editItem) {
            put(`/management/expenses/${editItem.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditItem(null);
                    reset();
                    clearErrors();
                }
            });
        } else {
            post('/management/expenses', {
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
            router.delete(`/management/expenses/${deleteId}`, {
                preserveScroll: true,
                onSuccess: () => setDeleteId(null)
            });
        }
    };

    return (
        <AppLayout title="Other Expenses">
            <Head title="Manage Expenses" />

            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20">
                <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div className="flex flex-col gap-6 w-full min-w-0">
                        <h1 className="text-3xl font-black text-black dark:text-white tracking-tight shrink-0">Management</h1>
                        <div className="flex gap-4 sm:gap-6 w-full overflow-x-auto no-scrollbar pb-[17px] -mb-[17px]">
                            <Link href="/management/suppliers" className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white pb-4 transition-colors">Suppliers</Link>
                            <Link href="/management/couriers" className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white pb-4 transition-colors">Couriers</Link>
                            <Link href="/management/categories" className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-black dark:hover:text-white pb-4 transition-colors">Categories</Link>
                            <Link href="/management/expenses" className="shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest text-black dark:text-white border-b-2 border-black dark:border-white pb-4">Other Expenses</Link>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 mb-1 mt-2 sm:mt-0">
                        <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                            <DialogTrigger asChild>
                                <button className="h-9 px-3 flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors shrink-0">
                                    <Filter className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle className="font-black text-xl uppercase tracking-widest">Filters</DialogTitle>
                                </DialogHeader>
                                <div className="flex flex-col gap-6 py-4">
                                    {/* Date Range */}
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Date Range</span>
                                        <div className="grid grid-cols-2 gap-2 w-full [&_button]:w-full">
                                            <DatePicker
                                                date={startDate}
                                                setDate={setStartDate}
                                                placeholder="Start Date"
                                            />
                                            <DatePicker
                                                date={endDate}
                                                setDate={setEndDate}
                                                placeholder="End Date"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                                    <Button variant="outline" onClick={clearFilters} className="font-bold uppercase tracking-widest text-[10px]">Clear</Button>
                                    <Button onClick={applyFilters} className="font-bold uppercase tracking-widest text-[10px]">Apply Filters</Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <a
                            href={`/management/expenses/export?start_date=${filters?.start_date || ''}&end_date=${filters?.end_date || ''}`}
                            className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 h-9 rounded-lg hover:scale-[1.02] active:scale-95 transition-all shadow-sm flex items-center justify-center shrink-0"
                        >
                            <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-widest">
                                EXPORT
                            </span>
                        </a>
                        <Button onClick={openAdd} className="uppercase tracking-widest text-[10px] font-bold px-4 py-2 h-9 shrink-0">
                            + New Expense
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col">
                    {expenses.data.length === 0 ? (
                        <EmptyState 
                            title="No Expenses Found" 
                            description="There are no expenses matching your search or filters." 
                            action={
                                <Button variant="outline" onClick={clearFilters} className="text-xs font-bold uppercase tracking-widest">
                                    Clear Filters
                                </Button>
                            }
                        />
                    ) : (
                        expenses.data.map((item) => (
                            <div key={item.id} className="py-4 border-b border-zinc-100 dark:border-zinc-800/50 flex justify-between items-center px-4 -mx-4 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                <div>
                                    <span className="text-base font-bold text-black dark:text-white block">{item.title}</span>
                                    <div className="flex gap-3 text-xs text-zinc-400 mt-1">
                                        <span>Date: {item.incurred_at.split('T')[0]}</span>
                                        {item.category && (
                                            <>
                                                <span>&bull;</span>
                                                <span className="uppercase tracking-widest">{item.category}</span>
                                            </>
                                        )}
                                    </div>
                                    {item.note && <p className="text-xs text-zinc-500 mt-1">{item.note}</p>}
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-bold text-black dark:text-white">MMK {Number(item.amount).toLocaleString()}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(item)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-3 py-1.5 rounded-md hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white uppercase tracking-widest transition-colors">
                                            Edit
                                        </button>
                                        <button onClick={() => setDeleteId(item.id)} className="text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-3 py-1.5 rounded-md hover:border-red-200 dark:hover:border-red-900/50 hover:text-red-600 dark:hover:text-red-500 uppercase tracking-widest transition-colors">
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-8">
                    <Pagination meta={expenses} />
                </div>
            </div>

            <Dialog open={isAddOpen || !!editItem} onOpenChange={(open) => {
                if (!open) {
                    setIsAddOpen(false);
                    setEditItem(null);
                    clearErrors();
                }
            }}>
                <DialogContent className="sm:max-w-[425px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                    <DialogHeader>
                        <DialogTitle>{editItem ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
                        <DialogDescription>
                            {editItem ? 'Update the details for this expense.' : 'Record a new operating expense.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="title">Title</Label>
                            <Input id="title" value={data.title} onChange={e => { setData('title', e.target.value); clearErrors('title'); }} placeholder="e.g. Facebook Ads" />
                            {errors.title && <span className="text-xs text-red-500">{errors.title}</span>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="amount">Amount (MMK)</Label>
                            <FormattedNumberInput id="amount" value={data.amount} onChange={val => { setData('amount', val); clearErrors('amount'); }} placeholder="e.g. 50000" />
                            {errors.amount && <span className="text-xs text-red-500">{errors.amount}</span>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="incurred_at">Date</Label>
                            <Input id="incurred_at" type="date" value={data.incurred_at} onChange={e => { setData('incurred_at', e.target.value); clearErrors('incurred_at'); }} />
                            {errors.incurred_at && <span className="text-xs text-red-500">{errors.incurred_at}</span>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="category">Category (Optional)</Label>
                            <Input id="category" value={data.category} onChange={e => { setData('category', e.target.value); clearErrors('category'); }} placeholder="e.g. Marketing, Packaging" />
                            {errors.category && <span className="text-xs text-red-500">{errors.category}</span>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="note">Notes (Optional)</Label>
                            <Input id="note" value={data.note} onChange={e => { setData('note', e.target.value); clearErrors('note'); }} placeholder="Any additional details..." />
                            {errors.note && <span className="text-xs text-red-500">{errors.note}</span>}
                        </div>
                        <DialogFooter className="mt-4">
                            <Button type="submit" disabled={processing} className="w-full sm:w-auto font-bold uppercase tracking-widest text-[10px]">
                                {editItem ? 'Save Changes' : 'Add Expense'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent className="sm:max-w-[425px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 dark:text-red-500">Delete Expense</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this expense record? This action cannot be undone and will affect your net profit calculation.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 flex gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteId(null)} className="w-full sm:w-auto font-bold uppercase tracking-widest text-[10px]">
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} className="w-full sm:w-auto font-bold uppercase tracking-widest text-[10px]">
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
