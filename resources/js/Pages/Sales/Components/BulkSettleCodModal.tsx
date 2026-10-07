import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PaymentMethodOption } from '@/types/sales';
import { DollarSign, Loader2 } from 'lucide-react';

interface BulkSettleCodModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOrderIds: number[];
    paymentMethods: PaymentMethodOption[];
    onSuccess?: () => void;
}

export default function BulkSettleCodModal({
    isOpen,
    onClose,
    selectedOrderIds,
    paymentMethods,
    onSuccess,
}: BulkSettleCodModalProps) {
    const [paymentMethod, setPaymentMethod] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleClose = () => {
        if (isSubmitting) return;
        setErrorMessage(null);
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!paymentMethod) {
            setErrorMessage('Please select a payment method to receive the funds.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        router.post(
            '/sales/bulk-settle',
            {
                order_ids: selectedOrderIds,
                payment_method: paymentMethod,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSubmitting(false);
                    onClose();
                    onSuccess?.();
                },
                onError: (errors) => {
                    setIsSubmitting(false);
                    const firstError = Object.values(errors)[0];
                    setErrorMessage(typeof firstError === 'string' ? firstError : 'Failed to settle COD orders.');
                },
            }
        );
    };

    const selectedMethod = paymentMethods.find((m) => m.code === paymentMethod);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[440px] w-full p-6">
                <DialogHeader className="space-y-1">
                    <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                        <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-lg font-black tracking-tight">
                            Bulk Settle COD Orders
                        </DialogTitle>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Settle {selectedOrderIds.length} delivered COD order
                        {selectedOrderIds.length === 1 ? '' : 's'} and record remittance into your account.
                    </p>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {errorMessage && (
                        <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
                            {errorMessage}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="payment_method" className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            Receiving Payment Method <span className="text-red-500">*</span>
                        </Label>
                        <Select value={paymentMethod} onValueChange={(val) => setPaymentMethod(val || '')}>
                            <SelectTrigger id="payment_method" className="h-10 w-full text-sm">
                                <SelectValue placeholder="Select account (e.g. KPay, Cash)...">
                                    {selectedMethod ? selectedMethod.name : 'Select account (e.g. KPay, Cash)...'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {paymentMethods.map((method) => (
                                    <SelectItem key={method.id} value={method.code}>
                                        {method.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 text-xs text-zinc-600 dark:text-zinc-400">
                        Orders will be marked as <strong className="text-zinc-900 dark:text-zinc-200">SETTLED</strong> and financial transactions will be created automatically for the remaining balance.
                    </div>

                    <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto h-10 text-xs font-bold uppercase tracking-wider"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting || !paymentMethod}
                            className="w-full sm:w-auto h-10 text-xs font-bold uppercase tracking-wider bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                    Settling...
                                </>
                            ) : (
                                `Confirm Settle (${selectedOrderIds.length})`
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
