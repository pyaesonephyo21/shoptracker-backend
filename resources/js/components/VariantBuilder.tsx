import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash, Plus, X, Upload } from 'lucide-react';

export interface VariantOption {
    name: string;
    values: string[];
}

export interface Variant {
    id?: number;
    sku: string;
    attributes: Record<string, string>;
    retail_price?: number | null;
    image_url?: string | null;
    image?: File | null;
    image_preview?: string | null;
    remove_image?: boolean;
}

interface Props {
    options: VariantOption[];
    setOptions: (options: VariantOption[]) => void;
    variants: Variant[];
    setVariants: (variants: Variant[]) => void;
    baseSku?: string;
}

export default function VariantBuilder({ options, setOptions, variants, setVariants, baseSku }: Props) {
    const [newOptionName, setNewOptionName] = useState('');
    const [randomPrefix] = useState(() => {
        const existing = variants.find(v => v.sku && v.sku.includes('-'));
        if (existing) {
            return existing.sku.split('-')[0];
        }
        return Math.random().toString(36).substring(2, 6).toUpperCase();
    });

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

    const handleImageChange = (idx: number, file: File | null) => {
        const newVariants = [...variants];
        if (file) {
            newVariants[idx].image = file;
            newVariants[idx].image_preview = URL.createObjectURL(file);
            newVariants[idx].remove_image = false;
        }
        setVariants(newVariants);
    };

    const handleRemoveImage = (idx: number) => {
        const newVariants = [...variants];
        newVariants[idx].image = null;
        newVariants[idx].image_preview = null;
        newVariants[idx].image_url = null;
        newVariants[idx].remove_image = true;
        setVariants(newVariants);
    };

    // Auto-generate variants when options change
    useEffect(() => {
        if (options.length === 0 || options.every(o => o.values.length === 0)) {
            // If no options, we just have one default variant
            if (variants.length !== 1 || Object.keys(variants[0].attributes || {}).length !== 0) {
                const defaultSku = baseSku ? `${baseSku}-DEF` : `${randomPrefix}-DEF`;
                setVariants([{ sku: defaultSku, attributes: {} }]);
            } else if (baseSku && variants[0].sku.startsWith(randomPrefix)) {
                setVariants([{ ...variants[0], sku: variants[0].sku.replace(randomPrefix, baseSku) }]);
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
                // Keep existing but update SKU if baseSku changed and it had the old default random prefix
                if (baseSku && existing.sku.startsWith(randomPrefix)) {
                    return {
                        ...existing,
                        sku: existing.sku.replace(randomPrefix, baseSku)
                    };
                }
                return existing;
            }

            // Generate SKU part
            const suffix = Object.values(combo).map(v => String(v).substring(0, 3).toUpperCase()).join('-');
            const prefix = baseSku || randomPrefix;
            return {
                sku: `${prefix}-${suffix}`,
                attributes: combo,
            };
        });

        // Check if newVariants is actually different from variants
        const isDifferent = newVariants.length !== variants.length || newVariants.some((nv, i) => {
            const old = variants[i];
            if (nv.sku !== old.sku) return true;
            if (nv.retail_price !== old.retail_price) return true;
            if (nv.image !== old.image) return true;
            if (nv.remove_image !== old.remove_image) return true;
            if (JSON.stringify(nv.attributes) !== JSON.stringify(old.attributes)) return true;
            return false;
        });

        if (isDifferent) {
            setVariants(newVariants);
        }
    }, [options, baseSku]);

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
                    <h3 className="font-bold text-sm tracking-tight">Generated Variants ({variants.length})</h3>
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase text-zinc-500 font-bold">
                                <tr>
                                    <th className="px-3 py-3 w-16 text-center">Photo</th>
                                    <th className="px-4 py-3">Variant</th>
                                    <th className="px-4 py-3 w-44">SKU</th>
                                    <th className="px-4 py-3 w-32">Price Override</th>
                                </tr>
                            </thead>
                            <tbody>
                                {variants.map((v, idx) => {
                                    const displayImg = v.image_preview || (!v.remove_image ? v.image_url : null);

                                    return (
                                        <tr key={idx} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 bg-white dark:bg-black">
                                            <td className="px-3 py-2 text-center align-middle">
                                                {displayImg ? (
                                                    <div className="relative inline-block group">
                                                        <img 
                                                            src={displayImg} 
                                                            alt={v.sku} 
                                                            className="w-10 h-10 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700" 
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveImage(idx)}
                                                            className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 shadow-sm hover:bg-red-700 transition-colors"
                                                            title="Remove image"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="cursor-pointer inline-flex items-center justify-center w-10 h-10 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-600 transition-colors">
                                                        <Upload className="w-4 h-4" />
                                                        <input 
                                                            type="file" 
                                                            accept="image/*" 
                                                            className="hidden" 
                                                            onChange={(e) => {
                                                                if (e.target.files && e.target.files[0]) {
                                                                    handleImageChange(idx, e.target.files[0]);
                                                                }
                                                            }} 
                                                        />
                                                    </label>
                                                )}
                                            </td>
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
                                                    value={v.retail_price ?? ''} 
                                                    onChange={e => {
                                                        const newVariants = [...variants];
                                                        newVariants[idx].retail_price = e.target.value ? Number(e.target.value) : undefined;
                                                        setVariants(newVariants);
                                                    }}
                                                    className="h-8"
                                                    placeholder="Default"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
