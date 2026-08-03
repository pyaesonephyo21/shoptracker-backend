import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import { twMerge } from 'tailwind-merge';

interface ManagementTab {
    name: string;
    href: string;
}

const MANAGEMENT_TABS: ManagementTab[] = [
    { name: 'Notes', href: '/management/notes' },
    { name: 'Other Expenses', href: '/management/expenses' },
    { name: 'Suppliers', href: '/management/suppliers' },
    { name: 'Couriers', href: '/management/couriers' },
    { name: 'Categories', href: '/management/categories' },
    { name: 'Payment Methods', href: '/management/payment-methods' },
];

interface ManagementHeaderProps {
    children?: React.ReactNode;
}

export default function ManagementHeader({ children }: ManagementHeaderProps) {
    const { url } = usePage();

    return (
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
            <div className="flex flex-col gap-6 w-full min-w-0">
                <h1 className="text-3xl font-black text-black dark:text-white tracking-tight shrink-0">Management</h1>
                <div className="flex gap-4 sm:gap-6 w-full overflow-x-auto no-scrollbar pb-[17px] -mb-[17px]">
                    {MANAGEMENT_TABS.map((tab) => {
                        const isActive = url === tab.href || url.startsWith(tab.href + '?') || url.startsWith(tab.href + '/');
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                prefetch={['mount', 'hover']}
                                cacheFor="1m"
                                className={twMerge(
                                    "shrink-0 whitespace-nowrap text-xs font-bold uppercase tracking-widest pb-4 transition-colors",
                                    isActive
                                        ? "text-black dark:text-white border-b-2 border-black dark:border-white"
                                        : "text-zinc-400 hover:text-black dark:hover:text-white"
                                )}
                            >
                                {tab.name}
                            </Link>
                        );
                    })}
                </div>
            </div>
            {children && (
                <div className="shrink-0 mt-2 sm:mt-0 mb-1 flex items-center gap-2">
                    {children}
                </div>
            )}
        </div>
    );
}
