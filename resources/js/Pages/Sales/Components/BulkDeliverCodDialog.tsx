import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface BulkDeliverCodDialogProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOrderIds: number[];
    onSuccess?: () => void;
}

export default function BulkDeliverCodDialog({
    isOpen,
    onClose,
    selectedOrderIds,
    onSuccess,
}: BulkDeliverCodDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleClose = () => {
        if (isSubmitting) return;
        setErrorMessage(null);
        onClose();
    };

    const handleConfirm = () => {
        setIsSubmitting(true);
        setErrorMessage(null);

        router.post(
            '/sales/bulk-deliver',
            {
                order_ids: selectedOrderIds,
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
                    setErrorMessage(typeof firstError === 'string' ? firstError : 'Failed to mark orders as delivered.');
                },
            }
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[420px] w-full p-6">
                <DialogHeader className="space-y-2">
                    <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                        <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-lg font-black tracking-tight">
                            Mark as Delivered
                        </DialogTitle>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Are you sure you want to mark {selectedOrderIds.length} COD order
                        {selectedOrderIds.length === 1 ? '' : 's'} as delivered?
                    </p>
                </DialogHeader>

                {errorMessage && (
                    <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg my-2">
                        {errorMessage}
                    </div>
                )}

                <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3 my-2 text-xs text-zinc-600 dark:text-zinc-400">
                    This will update the order status to <strong className="text-zinc-900 dark:text-zinc-200">DELIVERED</strong>.
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
                        type="button"
                        onClick={handleConfirm}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto h-10 text-xs font-bold uppercase tracking-wider bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                Updating...
                            </>
                        ) : (
                            `Mark Delivered (${selectedOrderIds.length})`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
