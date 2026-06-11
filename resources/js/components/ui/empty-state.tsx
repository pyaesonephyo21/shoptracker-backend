import React from 'react';
import { twMerge } from 'tailwind-merge';
import { PackageOpen } from 'lucide-react';

interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    action?: React.ReactNode;
    className?: string;
}

export function EmptyState({ 
    title, 
    description, 
    icon, 
    action, 
    className 
}: EmptyStateProps) {
    return (
        <div className={twMerge("mt-8 flex flex-col justify-center items-center p-12 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 text-center animate-in fade-in duration-500", className)}>
            <div className="w-16 h-16 bg-white dark:bg-black rounded-2xl shadow-sm flex items-center justify-center mb-6 text-zinc-400">
                {icon || <PackageOpen strokeWidth={1.5} className="w-8 h-8" />}
            </div>
            <h3 className="text-lg font-black text-black dark:text-white mb-2 tracking-tight">{title}</h3>
            {description && (
                <p className="text-sm font-medium text-zinc-500 max-w-sm mb-6 leading-relaxed">
                    {description}
                </p>
            )}
            {action && (
                <div>{action}</div>
            )}
        </div>
    );
}
