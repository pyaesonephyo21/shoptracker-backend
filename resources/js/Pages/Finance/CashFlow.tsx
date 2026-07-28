import React, { useState, useEffect, useRef } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import Pagination from '@/components/Pagination';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { format } from 'date-fns';

interface CashTransaction {
    id: number;
    shop_id: number;
    amount: string;
    type: string;
    description: string;
    created_at: string;
}

interface CashFlowProps {
    transactions: {
        data: CashTransaction[];
        links: any[];
        current_page: number;
        last_page: number;
        from: number | null;
        to: number | null;
        total: number;
    };
    totalBalance: number;
    filters: {
        start_date: string;
        end_date: string;
        type: string;
    };
}

export default function CashFlow({ transactions, totalBalance, filters }: CashFlowProps) {
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [modalType, setModalType] = useState<'manual_in' | 'manual_out'>('manual_in');

    // Filter State
    const [startDate, setStartDate] = useState<Date | undefined>(filters.start_date ? new Date(filters.start_date) : undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(filters.end_date ? new Date(filters.end_date) : undefined);
    const [typeFilter, setTypeFilter] = useState(filters.type || 'all');

    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        router.get('/finance/cash-flow', {
            start_date: startDate ? format(startDate, 'yyyy-MM-dd') : '',
            end_date: endDate ? format(endDate, 'yyyy-MM-dd') : '',
            type: typeFilter
        }, { preserveState: true, preserveScroll: true });
    }, [startDate, endDate, typeFilter]);

    const { data, setData, post, processing, errors, reset, clearErrors } = useForm({
        amount: '',
        type: 'manual_in',
        description: '',
    });

    const openModal = (type: 'manual_in' | 'manual_out') => {
        setModalType(type);
        setData('type', type);
        setData('amount', '');
        setData('description', type === 'manual_in' ? 'Initial Capital' : 'Owner Withdrawal');
        clearErrors();
        setIsManualModalOpen(true);
    };

    const submitManual = (e: React.FormEvent) => {
        e.preventDefault();
        post('/finance/cash-flow/manual', {
            onSuccess: () => {
                setIsManualModalOpen(false);
                reset();
            }
        });
    };

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'sale': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-0">Sale</Badge>;
            case 'expense': return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-0">Expense</Badge>;
            case 'purchase': return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-0">Purchase</Badge>;
            case 'manual_in': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-0">Manual In</Badge>;
            case 'manual_out': return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 border-0">Manual Out</Badge>;
            default: return <Badge variant="outline">{type}</Badge>;
        }
    };

    return (
        <AppLayout title="Cash Flow">
            <Head title="Cash Flow" />

            <div className="flex flex-col gap-6 sm:gap-8 pb-20">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <div>
                        <h1 className="text-2xl font-black text-black dark:text-white tracking-tight">
                            Cash Flow
                        </h1>
                        <p className="text-xs text-zinc-500 mt-1">Track your overall liquid cash balance</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                            onClick={() => openModal('manual_in')}
                        >
                            + Cash In
                        </Button>
                        <Button
                            variant="outline"
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                            onClick={() => openModal('manual_out')}
                        >
                            - Cash Out
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm flex flex-col justify-center items-center">
                        <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-2">Total Cash in Hand</p>
                        <h2 className={`text-4xl font-black tracking-tighter ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalBalance >= 0 ? '' : '-'}
                            {Math.abs(totalBalance).toLocaleString()} <span className="text-lg">MMK</span>
                        </h2>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 rounded-2xl shadow-sm flex flex-col h-full">
                    <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end mb-4 gap-4">
                        <h3 className="text-lg font-bold">Transaction Ledger</h3>

                        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full xl:w-auto">
                            <div className="grid grid-cols-2 sm:flex w-full sm:w-auto gap-2">
                                <div className="flex flex-col gap-1 w-full sm:flex-initial">
                                    <Label className="text-[9px] uppercase text-zinc-500 ml-1 font-bold">From</Label>
                                    <DatePicker
                                        date={startDate}
                                        setDate={setStartDate}
                                        placeholder="Start Date"
                                        className="w-full sm:w-[150px] h-8 shadow-sm bg-white dark:bg-zinc-950 text-xs"
                                    />
                                </div>
                                <div className="flex flex-col gap-1 w-full sm:flex-initial">
                                    <Label className="text-[9px] uppercase text-zinc-500 ml-1 font-bold">To</Label>
                                    <DatePicker
                                        date={endDate}
                                        setDate={setEndDate}
                                        placeholder="End Date"
                                        disabled={(date) => startDate ? date < new Date(startDate.setHours(0, 0, 0, 0)) : false}
                                        className="w-full sm:w-[150px] h-8 shadow-sm bg-white dark:bg-zinc-950 text-xs"
                                    />
                                </div>
                                <div className="flex flex-col gap-1 col-span-2 sm:flex-initial mt-1 sm:mt-0">
                                    <Label className="text-[9px] uppercase text-zinc-500 ml-1 font-bold">Type</Label>
                                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                                        <SelectTrigger className="w-full sm:w-[140px] h-8 shadow-sm bg-white dark:bg-zinc-950 text-xs truncate">
                                            {typeFilter === 'all' ? 'All Types' : typeFilter.replace('_', ' ').toUpperCase()}
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Types</SelectItem>
                                            <SelectItem value="sale">Sales</SelectItem>
                                            <SelectItem value="expense">Expenses</SelectItem>
                                            <SelectItem value="purchase">Purchases</SelectItem>
                                            <SelectItem value="manual_in">Manual In</SelectItem>
                                            <SelectItem value="manual_out">Manual Out</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden overflow-x-auto max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px] relative">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
                                <tr>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500">Date</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500">Type</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500 w-1/2">Description</th>
                                    <th className="px-4 py-3 font-bold text-[10px] uppercase tracking-wider text-zinc-500 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {transactions.data.map(txn => {
                                    const amount = parseFloat(txn.amount);
                                    return (
                                        <TableRow key={txn.id} txn={txn} amount={amount} getTypeBadge={getTypeBadge} />
                                    );
                                })}
                                {transactions.data.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-zinc-400 font-medium">No transactions found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4">
                        <Pagination meta={transactions} />
                    </div>
                </div>
            </div>

            <Dialog open={isManualModalOpen} onOpenChange={setIsManualModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{modalType === 'manual_in' ? 'Manual Cash In' : 'Manual Cash Out'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={submitManual} className="flex flex-col gap-4 mt-4">
                        <div>
                            <Label className='mb-2'>Amount (MMK)</Label>
                            <FormattedNumberInput
                                value={data.amount}
                                onChange={(val) => setData('amount', val)}
                                placeholder="0"
                            />
                            {errors.amount && <span className="text-red-500 text-xs">{errors.amount}</span>}
                        </div>
                        <div>
                            <Label className='mb-2'>Description</Label>
                            <Input
                                value={data.description}
                                onChange={e => setData('description', e.target.value)}
                                placeholder="e.g. Initial Capital"
                            />
                            {errors.description && <span className="text-red-500 text-xs">{errors.description}</span>}
                        </div>
                        <DialogFooter className="mt-4">
                            <Button type="button" variant="outline" onClick={() => setIsManualModalOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={processing} className={modalType === 'manual_in' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}>
                                Record {modalType === 'manual_in' ? 'Inflow' : 'Outflow'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

function TableRow({ txn, amount, getTypeBadge }: { txn: any, amount: number, getTypeBadge: any }) {
    return (
        <tr className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors">
            <td className="px-4 py-3 font-medium text-zinc-600 dark:text-zinc-400">
                {new Date(txn.created_at).toLocaleString('en-GB', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                })}
            </td>
            <td className="px-4 py-3">
                {getTypeBadge(txn.type)}
            </td>
            <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[300px]" title={txn.description || ''}>
                {txn.description || '-'}
            </td>
            <td className={`px-4 py-3 font-black text-right ${amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {amount > 0 ? '+' : ''}{amount.toLocaleString()}
            </td>
        </tr>
    );
}
