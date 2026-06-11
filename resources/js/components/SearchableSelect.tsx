import React, { useState, useRef, useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

interface Option {
    label: string;
    value: string | number;
}

interface SearchableSelectProps {
    value: string | number;
    onValueChange: (val: string) => void;
    options: Option[];
    placeholder?: string;
    className?: string;
    listClassName?: string;
}

export function SearchableSelect({
    value,
    onValueChange,
    options,
    placeholder = "Select...",
    className = "",
    listClassName = ""
}: SearchableSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus input on open, but only on desktop to avoid aggressive mobile keyboards
    useEffect(() => {
        if (isOpen && window.innerWidth >= 768) {
            setTimeout(() => inputRef.current?.focus(), 10);
        } else if (!isOpen) {
            setSearch(''); // clear search on close
        }
    }, [isOpen]);

    const filteredOptions = options.filter(opt => 
        opt.label.toLowerCase().includes(search.toLowerCase())
    );

    const selectedLabel = options.find(opt => opt.value.toString() === value.toString())?.label;

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={twMerge(
                    "flex h-10 w-full items-center justify-between rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:ring-offset-zinc-950 dark:placeholder:text-zinc-400 dark:focus:ring-zinc-300",
                    className
                )}
            >
                <span className={!selectedLabel ? "text-zinc-500" : ""}>
                    {selectedLabel || placeholder}
                </span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4 opacity-50"
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>

            {isOpen && (
                <div 
                    className={twMerge(
                        "absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border border-zinc-200 bg-white text-zinc-950 shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50",
                        listClassName
                    )}
                >
                    <div className="p-2 border-b border-zinc-100 dark:border-zinc-800">
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search products..."
                            className="w-full bg-transparent px-2 py-1 text-sm outline-none placeholder:text-zinc-400"
                            onClick={e => e.stopPropagation()} // Prevent double trigger
                        />
                    </div>
                    <div className="overflow-y-auto max-h-48 p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="px-2 py-4 text-center text-sm text-zinc-500">
                                No results found.
                            </div>
                        ) : (
                            filteredOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        onValueChange(opt.value.toString());
                                        setIsOpen(false);
                                    }}
                                    className={twMerge(
                                        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 text-left",
                                        value.toString() === opt.value.toString() ? "bg-zinc-100 dark:bg-zinc-800 font-medium" : ""
                                    )}
                                >
                                    {opt.label}
                                    {value.toString() === opt.value.toString() && (
                                        <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
