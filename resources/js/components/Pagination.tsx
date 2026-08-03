import { Link } from '@inertiajs/react';
import { twMerge } from 'tailwind-merge';

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginationMeta {
    from: number | null;
    to: number | null;
    total: number;
    links: PaginationLink[];
}

interface PaginationProps {
    meta: PaginationMeta;
    className?: string;
}

export default function Pagination({ meta, className = '' }: PaginationProps) {
    if (!meta?.links || meta.links.length <= 3) return null; // Only Previous, Next, and Page 1 (no need to show if only 1 page)

    return (
        <div className={twMerge("flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 mb-4", className)}>
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {(meta.total ?? 0) > 0 ? (
                    <>Showing <span className="font-medium text-black dark:text-white">{meta.from}</span> to <span className="font-medium text-black dark:text-white">{meta.to}</span> of <span className="font-medium text-black dark:text-white">{meta.total}</span> results</>
                ) : (
                    "No results found"
                )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1">
                {meta.links.map((link, index) => {
                    const isActive = link.active;
                    const isDisabled = !link.url;

                    // Handle HTML entities in Laravel labels like &laquo; and &raquo;
                    let label = link.label
                        .replace(/&laquo;/g, '«')
                        .replace(/&raquo;/g, '»')
                        .replace('Previous', '«')
                        .replace('Next', '»');

                    if (isDisabled) {
                        return (
                            <div
                                key={index}
                                className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900 cursor-not-allowed select-none"
                                dangerouslySetInnerHTML={{ __html: label }}
                            />
                        );
                    }

                    let href = link.url as string;
                    try {
                        const urlObj = new URL(href);
                        href = urlObj.pathname + urlObj.search;
                    } catch (e) {}

                    return (
                        <Link
                            key={index}
                            href={href}
                            preserveState
                            preserveScroll
                            className={twMerge(
                                "px-3 py-2 rounded-lg text-sm font-medium transition-all",
                                isActive 
                                    ? "bg-black text-white dark:bg-white dark:text-black shadow-md" 
                                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            )}
                            dangerouslySetInnerHTML={{ __html: label }}
                        />
                    );
                })}
            </div>
        </div>
    );
}
