import React, { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { twMerge } from 'tailwind-merge';

export function GlobalToast() {
    const { props } = usePage<any>();
    const { flash, errors } = props;
    const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

    useEffect(() => {
        let msg = null;
        let type: 'success' | 'error' = 'success';
        
        if (flash?.success) {
            msg = flash.success;
            type = 'success';
        } else if (flash?.error) {
            msg = flash.error;
            type = 'error';
        } else if (errors?.error) {
            msg = Array.isArray(errors.error) ? errors.error[0] : errors.error;
            type = 'error';
        }

        if (msg) {
            setToast({ message: msg, type });
            const t = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(t);
        }
    }, [flash, errors]);

    if (!toast) return null;

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 w-max max-w-[90vw]">
            <div className={twMerge(
                "px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 font-medium text-sm",
                toast.type === 'success' 
                    ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/90 dark:border-green-800 dark:text-green-100" 
                    : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/90 dark:border-red-800 dark:text-red-100"
            )}>
                {toast.type === 'success' ? (
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                ) : (
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                )}
                <span>{toast.message}</span>
                <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
