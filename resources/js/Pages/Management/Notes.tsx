import React, { useState } from 'react';
import AppLayout from '../../Layouts/AppLayout';
import { Head, useForm, Link, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PaginatedData } from '@/types/pagination';
import Pagination from '@/components/Pagination';
import ManagementHeader from '@/components/ManagementHeader';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

interface User {
    id: number;
    name: string;
}

interface Note {
    id: number;
    shop_id: number;
    user_id: number | null;
    user?: User | null;
    type: 'customer' | 'general';
    title: string;
    customer_name: string | null;
    customer_phone: string | null;
    content: string | null;
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
}

interface NotesProps {
    notes: PaginatedData<Note>;
    filters: {
        type: string;
        search: string;
    };
}

export default function Notes({ notes, filters }: NotesProps) {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editItem, setEditItem] = useState<Note | null>(null);
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState(filters.search || '');

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({
        type: 'customer' as 'customer' | 'general',
        title: '',
        customer_name: '',
        customer_phone: '',
        content: '',
        is_pinned: false,
    });

    const openAdd = (defaultType: 'customer' | 'general' = 'customer') => {
        reset();
        setData({
            type: defaultType,
            title: '',
            customer_name: '',
            customer_phone: '',
            content: '',
            is_pinned: false,
        });
        setIsAddOpen(true);
    };

    const openEdit = (item: Note) => {
        setData({
            type: item.type,
            title: item.title,
            customer_name: item.customer_name || '',
            customer_phone: item.customer_phone || '',
            content: item.content || '',
            is_pinned: Boolean(item.is_pinned),
        });
        setEditItem(item);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editItem) {
            put(`/management/notes/${editItem.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditItem(null);
                    reset();
                    clearErrors();
                }
            });
        } else {
            post('/management/notes', {
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
            router.delete(`/management/notes/${deleteId}`, {
                preserveScroll: true,
                onSuccess: () => setDeleteId(null)
            });
        }
    };

    const togglePin = (id: number) => {
        router.post(`/management/notes/${id}/toggle-pin`, {}, {
            preserveScroll: true,
        });
    };

    const handleFilterChange = (type: string) => {
        router.get('/management/notes', {
            type: type === 'all' ? undefined : type,
            search: searchQuery || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/management/notes', {
            type: filters.type !== 'all' ? filters.type : undefined,
            search: searchQuery || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const clearSearch = () => {
        setSearchQuery('');
        router.get('/management/notes', {
            type: filters.type !== 'all' ? filters.type : undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <AppLayout title="Notes">
            <Head title="Manage Notes" />

            <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full pb-20">
                {/* Universal Header & Tabs */}
                <ManagementHeader>
                    <Button onClick={() => openAdd('customer')} className="uppercase tracking-widest text-[10px] font-bold px-4 py-2 h-9">
                        + New Note
                    </Button>
                </ManagementHeader>

                {/* Filter Chips & Search Bar */}
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                    {/* Category Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl overflow-x-auto no-scrollbar">
                        <button
                            type="button"
                            onClick={() => handleFilterChange('all')}
                            className={twMerge(
                                "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all",
                                (filters.type === 'all' || !filters.type)
                                    ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-xs"
                                    : "text-zinc-500 hover:text-black dark:hover:text-white"
                            )}
                        >
                            All Notes
                        </button>
                        <button
                            type="button"
                            onClick={() => handleFilterChange('customer')}
                            className={twMerge(
                                "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5",
                                filters.type === 'customer'
                                    ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-xs"
                                    : "text-zinc-500 hover:text-black dark:hover:text-white"
                            )}
                        >
                            <span>👤</span>
                            <span>Customer Requests & Memos</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleFilterChange('general')}
                            className={twMerge(
                                "px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5",
                                filters.type === 'general'
                                    ? "bg-white dark:bg-zinc-800 text-black dark:text-white shadow-xs"
                                    : "text-zinc-500 hover:text-black dark:hover:text-white"
                            )}
                        >
                            <span>📝</span>
                            <span>General Notes</span>
                        </button>
                    </div>

                    {/* Search */}
                    <form onSubmit={handleSearch} className="relative flex-1 sm:max-w-xs">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search notes, names, phone..."
                            className="w-full h-9 pl-9 pr-8 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-white outline-none"
                        />
                        <svg className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="absolute right-2.5 top-2 text-zinc-400 hover:text-black dark:hover:text-white"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                    </form>
                </div>

                {/* Notes Grid */}
                <div className="flex flex-col gap-3">
                    {notes.data.length === 0 ? (
                        <EmptyState 
                            title="No Notes Found" 
                            description={searchQuery ? "No notes matched your search query." : "You haven't added any notes yet."} 
                        />
                    ) : (
                        notes.data.map((item) => {
                            const isCustomer = item.type === 'customer';
                            return (
                                <div
                                    key={item.id}
                                    className={twMerge(
                                        "p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col gap-3 group relative",
                                        item.is_pinned
                                            ? "bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 shadow-xs"
                                            : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700"
                                    )}
                                >
                                    {/* Top Row: Type Tag, Author & Pin Toggle */}
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className={twMerge(
                                                "text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-md",
                                                isCustomer 
                                                    ? "bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50"
                                                    : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                                            )}>
                                                {isCustomer ? '👤 Customer' : '📝 General'}
                                            </span>

                                            {item.user && (
                                                <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                                    Added by <strong className="text-zinc-700 dark:text-zinc-200 font-semibold">{item.user.name}</strong>
                                                </span>
                                            )}

                                            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                                                • {formatDate(item.created_at)}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => togglePin(item.id)}
                                            title={item.is_pinned ? "Unpin Note" : "Pin to top"}
                                            className={twMerge(
                                                "p-1.5 rounded-lg text-sm transition-all active:scale-90",
                                                item.is_pinned 
                                                    ? "text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/50" 
                                                    : "text-zinc-400 hover:text-amber-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                            )}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={item.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Title */}
                                    <h3 className="text-base sm:text-lg font-black text-black dark:text-white tracking-tight leading-snug">
                                        {item.title}
                                    </h3>

                                    {/* Customer Details Box if applicable */}
                                    {isCustomer && (item.customer_name || item.customer_phone) && (
                                        <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-100 dark:border-zinc-800/80 text-xs">
                                            {item.customer_name && (
                                                <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-200 font-bold">
                                                    <span>Customer:</span>
                                                    <span>{item.customer_name}</span>
                                                </div>
                                            )}

                                            {item.customer_phone && (
                                                <a 
                                                    href={`tel:${item.customer_phone}`}
                                                    className="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold hover:underline bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800/40 active:scale-95 transition-all"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                                    </svg>
                                                    <span>{item.customer_phone}</span>
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    {/* Content Body */}
                                    {item.content && (
                                        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                            {item.content}
                                        </p>
                                    )}

                                    {/* Bottom Action Row */}
                                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/50">
                                        <button
                                            type="button"
                                            onClick={() => openEdit(item)}
                                            className="text-[11px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 bg-transparent px-2.5 py-1.5 rounded-lg hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-black dark:hover:text-white active:scale-95 transition-all"
                                        >
                                            EDIT
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setDeleteId(item.id)}
                                            className="inline-flex items-center gap-1.5 text-[11px] font-bold bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black px-3 py-1.5 rounded-lg hover:bg-emerald-700 active:scale-95 transition-all shadow-xs"
                                            title="Mark completed and remove note"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>COMPLETE</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {notes.data.length > 0 && <Pagination meta={notes} />}
            </div>

            {/* Add / Edit Dialog */}
            <Dialog open={isAddOpen || !!editItem} onOpenChange={(open) => {
                if (!open) {
                    setIsAddOpen(false);
                    setEditItem(null);
                    reset();
                    clearErrors();
                }
            }}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black tracking-tight">
                            {editItem ? 'Edit Note' : 'Create New Note'}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-zinc-500">
                            {editItem 
                                ? 'Update note details, customer request or instructions.'
                                : 'Record a customer request, restock notification reminder, or general shop note.'
                            }
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
                        {/* Type Selector */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-xs font-bold">Note Type</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setData('type', 'customer')}
                                    className={twMerge(
                                        "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all",
                                        data.type === 'customer'
                                            ? "border-black dark:border-white bg-black text-white dark:bg-white dark:text-black shadow-xs"
                                            : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                                    )}
                                >
                                    <span>👤</span>
                                    <span>Customer Request</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setData('type', 'general')}
                                    className={twMerge(
                                        "p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all",
                                        data.type === 'general'
                                            ? "border-black dark:border-white bg-black text-white dark:bg-white dark:text-black shadow-xs"
                                            : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                                    )}
                                >
                                    <span>📝</span>
                                    <span>General Note</span>
                                </button>
                            </div>
                        </div>

                        {/* Customer Info (Shown for customer type) */}
                        {data.type === 'customer' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80">
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="customer_name" className="text-xs font-bold">Customer Name</Label>
                                    <Input
                                        id="customer_name"
                                        value={data.customer_name}
                                        onChange={(e) => setData('customer_name', e.target.value)}
                                        placeholder="e.g. Daw Su"
                                        className="h-9 text-xs"
                                    />
                                    {errors.customer_name && <span className="text-[10px] text-red-500 font-bold">{errors.customer_name}</span>}
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="customer_phone" className="text-xs font-bold">Phone Number</Label>
                                    <Input
                                        id="customer_phone"
                                        type="tel"
                                        value={data.customer_phone}
                                        onChange={(e) => setData('customer_phone', e.target.value)}
                                        placeholder="e.g. 0912345678"
                                        className="h-9 text-xs"
                                    />
                                    {errors.customer_phone && <span className="text-[10px] text-red-500 font-bold">{errors.customer_phone}</span>}
                                </div>
                            </div>
                        )}

                        {/* Title */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="title" className="text-xs font-bold">
                                Title / Subject <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="title"
                                value={data.title}
                                onChange={(e) => setData('title', e.target.value)}
                                placeholder={data.type === 'customer' ? "e.g. Notify when Nike shoes size 42 arrives" : "e.g. Supplier meeting on Friday"}
                                required
                                className="h-9 text-xs"
                            />
                            {errors.title && <span className="text-[10px] text-red-500 font-bold">{errors.title}</span>}
                        </div>

                        {/* Details / Content */}
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="content" className="text-xs font-bold">Details & Specifics</Label>
                            <textarea
                                id="content"
                                rows={3}
                                value={data.content}
                                onChange={(e) => setData('content', e.target.value)}
                                placeholder="Enter specific product details, quantity requested, special instructions, or notes..."
                                className="w-full text-xs p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-1 focus:ring-black dark:focus:ring-white outline-none resize-none"
                            />
                            {errors.content && <span className="text-[10px] text-red-500 font-bold">{errors.content}</span>}
                        </div>

                        {/* Pin to top */}
                        <div className="flex items-center gap-2 pt-1">
                            <input
                                id="is_pinned"
                                type="checkbox"
                                checked={data.is_pinned}
                                onChange={(e) => setData('is_pinned', e.target.checked)}
                                className="w-4 h-4 rounded-sm border-zinc-300 dark:border-zinc-700 text-black dark:text-white focus:ring-0"
                            />
                            <Label htmlFor="is_pinned" className="text-xs font-bold cursor-pointer select-none">
                                Pin this note to the top ⭐
                            </Label>
                        </div>

                        <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setIsAddOpen(false);
                                    setEditItem(null);
                                    reset();
                                    clearErrors();
                                }}
                                className="text-xs font-bold"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={processing}
                                className="text-xs font-bold"
                            >
                                {processing ? 'Saving...' : editItem ? 'Save Changes' : 'Create Note'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Complete / Delete Confirmation Dialog */}
            <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black tracking-tight">Complete / Remove Note</DialogTitle>
                        <DialogDescription className="text-xs text-zinc-500">
                            Are you sure you want to mark this note as completed and remove it?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setDeleteId(null)} className="text-xs font-bold">
                            Cancel
                        </Button>
                        <Button onClick={handleDelete} className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white">
                            Complete & Remove
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
