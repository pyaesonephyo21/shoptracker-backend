import React, { useState } from 'react';
import { router } from '@inertiajs/react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { FormattedNumberInput } from '@/components/ui/formatted-number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CourierOption } from '@/types/sales';
import { Truck, Loader2 } from 'lucide-react';

interface BulkFulfillCodModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedOrderIds: number[];
    couriers: CourierOption[];
    onSuccess?: () => void;
}

export default function BulkFulfillCodModal({
    isOpen,
    onClose,
    selectedOrderIds,
    couriers,
    onSuccess,
}: BulkFulfillCodModalProps) {
    const [courierId, setCourierId] = useState<string>('');
    const [deliveryFee, setDeliveryFee] = useState<string>('');
    const [courierServiceFee, setCourierServiceFee] = useState<string>('');
    const [overcharge, setOvercharge] = useState<string>('');
    const [deliveryNote, setDeliveryNote] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleCourierChange = (val: string | null) => {
        const idStr = val || '';
        setCourierId(idStr);
        const selected = couriers.find((c) => String(c.id) === idStr);
        if (selected) {
            setCourierServiceFee(selected.default_service_fee ? String(selected.default_service_fee) : '');
            setOvercharge(selected.default_overcharge ? String(selected.default_overcharge) : '');
        }
    };

    const handleClose = () => {
        if (isSubmitting) return;
        setErrorMessage(null);
        onClose();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!courierId) {
            setErrorMessage('Please select a courier.');
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        router.post(
            '/sales/bulk-fulfill',
            {
                order_ids: selectedOrderIds,
                courier_id: Number(courierId),
                delivery_fee: deliveryFee !== '' ? Number(deliveryFee) : null,
                courier_service_fee: courierServiceFee !== '' ? Number(courierServiceFee) : null,
                overcharge: overcharge !== '' ? Number(overcharge) : null,
                delivery_note: deliveryNote || null,
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
                    setErrorMessage(typeof firstError === 'string' ? firstError : 'Failed to arrange bulk delivery.');
                },
            }
        );
    };

    const selectedCourier = couriers.find((c) => String(c.id) === courierId);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-[480px] w-full p-6">
                <DialogHeader className="space-y-1">
                    <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                        <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800">
                            <Truck className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-lg font-black tracking-tight">
                            Bulk Delivery (COD Orders)
                        </DialogTitle>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Assign courier and delivery fees to {selectedOrderIds.length} selected COD order
                        {selectedOrderIds.length === 1 ? '' : 's'}.
                    </p>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    {errorMessage && (
                        <div className="p-3 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg">
                            {errorMessage}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <Label htmlFor="courier" className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            Courier <span className="text-red-500">*</span>
                        </Label>
                        <Select value={courierId} onValueChange={handleCourierChange}>
                            <SelectTrigger id="courier" className="h-10 w-full text-sm">
                                <SelectValue placeholder="Select courier...">
                                    {selectedCourier ? selectedCourier.name : 'Select courier...'}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {couriers.map((courier) => (
                                    <SelectItem key={courier.id} value={String(courier.id)}>
                                        {courier.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="customer_delivery_fee" className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                                Customer Deli Fee (MMK)
                            </Label>
                            <FormattedNumberInput
                                id="customer_delivery_fee"
                                value={deliveryFee}
                                onChange={setDeliveryFee}
                                placeholder="e.g. 2,500"
                                className="h-10 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="courier_service_fee" className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                                Courier Service Fee (MMK)
                            </Label>
                            <FormattedNumberInput
                                id="courier_service_fee"
                                value={courierServiceFee}
                                onChange={setCourierServiceFee}
                                placeholder="e.g. 2,000"
                                className="h-10 text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="overcharge" className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            Overcharge (MMK)
                        </Label>
                        <FormattedNumberInput
                            id="overcharge"
                            value={overcharge}
                            onChange={setOvercharge}
                            placeholder="Optional"
                            className="h-10 text-sm"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="delivery_note" className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                            Delivery Note
                        </Label>
                        <Input
                            id="delivery_note"
                            value={deliveryNote}
                            onChange={(e) => setDeliveryNote(e.target.value)}
                            placeholder="Optional instructions for delivery"
                            className="h-10 text-sm"
                        />
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
                            disabled={isSubmitting || !courierId}
                            className="w-full sm:w-auto h-10 text-xs font-bold uppercase tracking-wider bg-black text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                    Assigning...
                                </>
                            ) : (
                                `Assign Delivery (${selectedOrderIds.length})`
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
