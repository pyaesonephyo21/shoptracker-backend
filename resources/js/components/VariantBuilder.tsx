import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateAcronym, formatAttributeValue } from '@/lib/skuGenerator';

export interface VariantOption {
    name: string;
    values: string[];
}

export interface Variant {
    id?: number;
    sku: string;
    attributes: Record<string, string>;
    retail_price?: number | null;
}

interface Props {
    options: VariantOption[];
    setOptions: (options: VariantOption[]) => void;
    variants: Variant[];
    setVariants: (variants: Variant[]) => void;
    productName?: string;
    categoryId?: string;
    categoryName?: string;
    baseSku?: string;
    isEditing?: boolean;
}

export default function VariantBuilder({
    options,
    setOptions,
    variants,
    setVariants,
    productName,
    categoryId,
    categoryName,
    baseSku,
    isEditing = false,
}: Props) {
    const [newOptionName, setNewOptionName] = useState('');

    const isEditMode = isEditing || variants.some(v => typeof v.id === 'number');
    const existingPrefix = isEditMode
        ? variants.find(v => v.sku && v.sku.includes('-'))?.sku?.split('-')[0]
        : null;

    const [activeBaseCode, setActiveBaseCode] = useState<string>(() => {
        if (baseSku) return baseSku;
        if (existingPrefix) return existingPrefix;
        return `${generateAcronym(productName || '', categoryName)}01`;
    });

    const prevBaseCodeRef = useRef(activeBaseCode);

    useEffect(() => {
        if (isEditMode || baseSku) return;

        const localAcronym = generateAcronym(productName || '', categoryName);
        const localCode = `${localAcronym}01`;

        if (!productName?.trim()) {
            setActiveBaseCode(localCode);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams();
                if (productName) params.set('name', productName.trim());
                if (categoryId) params.set('category_id', categoryId);

                const res = await fetch(`/inventory/suggest-sku?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.base_code) {
                        setActiveBaseCode(data.base_code);
                        return;
                    }
                }
            } catch {
                // Fallback to local acronym
            }
            setActiveBaseCode(localCode);
        }, 250);

        return () => clearTimeout(timer);
    }, [productName, categoryId, categoryName, isEditMode, baseSku]);

    const addOption = () => {
        if (!newOptionName.trim()) return;
        if (options.find(o => o.name.toLowerCase() === newOptionName.trim().toLowerCase())) return;
        
        setOptions([...options, { name: newOptionName.trim(), values: [] }]);
        setNewOptionName('');
    };

    const removeOption = (idx: number) => {
        const newOptions = [...options];
        newOptions.splice(idx, 1);
        setOptions(newOptions);
    };

    const addValue = (optionIdx: number, value: string) => {
        if (!value.trim()) return;
        const newOptions = [...options];
        if (!newOptions[optionIdx].values.includes(value.trim())) {
            newOptions[optionIdx].values.push(value.trim());
            setOptions(newOptions);
        }
    };

    const removeValue = (optionIdx: number, valueIdx: number) => {
        const newOptions = [...options];
        newOptions[optionIdx].values.splice(valueIdx, 1);
        setOptions(newOptions);
    };

    // Auto-generate variants when options change
    useEffect(() => {
        const prefix = baseSku || existingPrefix || activeBaseCode;
        const prevPrefix = prevBaseCodeRef.current;
        prevBaseCodeRef.current = prefix;

        if (options.length === 0 || options.every(o => o.values.length === 0)) {
            // If no options, we just have one default variant
            if (variants.length !== 1 || Object.keys(variants[0].attributes || {}).length !== 0) {
                setVariants([{ sku: `${prefix}-DEF`, attributes: {} }]);
            } else if (prevPrefix && variants[0]?.sku && prevPrefix !== prefix) {
                const currentSku = variants[0].sku;
                if (currentSku.startsWith(`${prevPrefix}-`) || currentSku.startsWith('PRD01-')) {
                    setVariants([{ ...variants[0], sku: `${prefix}-DEF` }]);
                }
            }
            return;
        }

        // Generate combinations
        const combinations: Record<string, string>[] = [{}];
        
        for (const option of options) {
            if (option.values.length === 0) continue;
            
            const newCombinations: Record<string, string>[] = [];
            for (const combo of combinations) {
                for (const value of option.values) {
                    newCombinations.push({ ...combo, [option.name]: value });
                }
            }
            combinations.splice(0, combinations.length, ...newCombinations);
        }

        const newVariants: Variant[] = combinations.map((combo) => {
            // Find if we already have this combination
            const existing = variants.find(v => {
                const keys = Object.keys(combo);
                if (keys.length !== Object.keys(v.attributes || {}).length) return false;
                return keys.every(k => v.attributes?.[k] === combo[k]);
            });

            if (existing) {
                // Keep existing but update SKU if prefix changed
                if (prevPrefix && prevPrefix !== prefix) {
                    if (existing.sku.startsWith(`${prevPrefix}-`)) {
                        return {
                            ...existing,
                            sku: existing.sku.replace(`${prevPrefix}-`, `${prefix}-`),
                        };
                    }
                    if (existing.sku.startsWith('PRD01-')) {
                        return {
                            ...existing,
                            sku: existing.sku.replace('PRD01-', `${prefix}-`),
                        };
                    }
                }
                return existing;
            }

            // Generate clean dynamic SKU part using actual input data
            const suffix = Object.values(combo).map(v => formatAttributeValue(v)).join('-');
            return {
                sku: suffix ? `${prefix}-${suffix}` : `${prefix}-DEF`,
                attributes: combo,
            };
        });

        // Check if newVariants is actually different from variants
        const isDifferent = newVariants.length !== variants.length || newVariants.some((nv, i) => {
            const old = variants[i];
            if (!old) return true;
            if (nv.sku !== old.sku) return true;
            if (nv.retail_price !== old.retail_price) return true;
            if (JSON.stringify(nv.attributes) !== JSON.stringify(old.attributes)) return true;
            return false;
        });

        if (isDifferent) {
            setVariants(newVariants);
        }
    }, [options, activeBaseCode, baseSku, existingPrefix]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <h3 className="font-bold text-sm tracking-tight">Variant Options</h3>
                
                {options.map((opt, idx) => (
                    <div key={idx} className="flex flex-col gap-2 p-3 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-sm">{opt.name}</span>
                            <button type="button" onClick={() => removeOption(idx)} className="text-red-500 hover:text-red-600">
                                <Trash className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {opt.values.map((v, vIdx) => (
                                <div key={vIdx} className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-sm">
                                    <span>{v}</span>
                                    <button type="button" onClick={() => removeValue(idx, vIdx)} className="text-zinc-500 hover:text-red-500">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <Input 
                                placeholder="Add value (e.g. Red, Large)..." 
                                className="w-48 h-8 text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addValue(idx, e.currentTarget.value);
                                        e.currentTarget.value = '';
                                    }
                                }}
                                onBlur={(e) => {
                                    addValue(idx, e.currentTarget.value);
                                    e.currentTarget.value = '';
                                }}
                            />
                        </div>
                    </div>
                ))}

                <div className="flex items-center gap-2">
                    <Input 
                        placeholder="New option (e.g. Color, Size)" 
                        value={newOptionName}
                        onChange={e => setNewOptionName(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                addOption();
                            }
                        }}
                    />
                    <Button type="button" variant="outline" onClick={addOption}>
                        <Plus className="w-4 h-4 mr-1" /> Add Option
                    </Button>
                </div>
            </div>

            {variants.length > 0 && (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm tracking-tight">Generated Variants ({variants.length})</h3>
                        <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-700">
                            Base SKU: <strong className="text-zinc-900 dark:text-zinc-100">{baseSku || existingPrefix || activeBaseCode}</strong>
                        </span>
                    </div>
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase text-zinc-500 font-bold">
                                <tr>
                                    <th className="px-4 py-3">Variant</th>
                                    <th className="px-4 py-3 w-48">SKU</th>
                                    <th className="px-4 py-3 w-32">Retail Price Override</th>
                                </tr>
                            </thead>
                            <tbody>
                                {variants.map((v, idx) => (
                                    <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 bg-white dark:bg-black">
                                        <td className="px-4 py-3 font-medium">
                                            {Object.values(v.attributes || {}).join(' / ') || 'Default'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Input 
                                                value={v.sku} 
                                                onChange={e => {
                                                    const newVariants = [...variants];
                                                    newVariants[idx].sku = e.target.value;
                                                    setVariants(newVariants);
                                                }}
                                                className="h-8"
                                                placeholder="SKU"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <Input 
                                                type="number" 
                                                value={v.retail_price || ''} 
                                                onChange={e => {
                                                    const newVariants = [...variants];
                                                    newVariants[idx].retail_price = e.target.value ? Number(e.target.value) : undefined;
                                                    setVariants(newVariants);
                                                }}
                                                className="h-8"
                                                placeholder="Fallback to Default"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
