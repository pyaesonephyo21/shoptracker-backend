import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { parseMyanmarAddress, ParsedCustomerInfo } from '@/lib/addressParser';
import { Sparkles, Clipboard, Check, X, ChevronDown, ChevronUp, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SmartAddressPasteProps {
    onApply: (data: { customer_name: string; customer_phone: string; address: string; delivery_notes?: string }) => void;
    className?: string;
}

export default function SmartAddressPaste({ onApply, className = '' }: SmartAddressPasteProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [rawText, setRawText] = useState('');
    const [parsedData, setParsedData] = useState<ParsedCustomerInfo>({
        customer_name: '',
        customer_phone: '',
        address: '',
        confidence: 'low'
    });
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiSource, setAiSource] = useState<'local' | 'ai' | null>(null);
    const [aiMessage, setAiMessage] = useState<string | null>(null);
    const [appliedToast, setAppliedToast] = useState(false);

    // Live instant parsing via local regex/heuristics on text change
    useEffect(() => {
        if (!rawText.trim()) {
            setParsedData({ customer_name: '', customer_phone: '', address: '', confidence: 'low' });
            setAiSource(null);
            setAiMessage(null);
            return;
        }

        // Only parse locally if not currently showing AI result
        if (aiSource !== 'ai') {
            const localResult = parseMyanmarAddress(rawText);
            setParsedData(localResult);
            setAiSource('local');
        }
    }, [rawText]);

    // Handle 1-tap clipboard paste
    const handlePasteClipboard = async () => {
        try {
            if (navigator.clipboard && navigator.clipboard.readText) {
                const text = await navigator.clipboard.readText();
                if (text && text.trim()) {
                    setRawText(text);
                    setAiSource(null);
                    setAiMessage(null);
                }
            } else {
                setAiMessage('Clipboard permission not supported on this browser. Please paste directly into the box.');
            }
        } catch (err) {
            console.warn('Clipboard read failed:', err);
            setAiMessage('Please paste manually using Ctrl+V / Paste.');
        }
    };

    // Handle AI Parsing via OpenRouter
    const handleAiParse = async () => {
        if (!rawText.trim()) return;

        setIsAiLoading(true);
        setAiMessage(null);

        try {
            const response = await axios.post('/api/ai/parse-address', { text: rawText });
            if (response.data && response.data.success && response.data.data) {
                const aiData = response.data.data;
                setParsedData({
                    customer_name: aiData.customer_name || '',
                    customer_phone: aiData.customer_phone || '',
                    address: aiData.address || '',
                    delivery_notes: aiData.delivery_notes || '',
                    confidence: 'high'
                });
                setAiSource('ai');
                setAiMessage('✨ Enhanced with AI');
            } else {
                // Fallback to local parsing
                const localResult = parseMyanmarAddress(rawText);
                setParsedData(localResult);
                setAiSource('local');
                setAiMessage(response.data?.message || 'Using smart local parser (AI key not set).');
            }
        } catch (err: any) {
            console.error('AI Parse error:', err);
            const localResult = parseMyanmarAddress(rawText);
            setParsedData(localResult);
            setAiSource('local');
            setAiMessage('AI service unreachable. Used smart local parser.');
        } finally {
            setIsAiLoading(false);
        }
    };

    // Handle Apply to Form
    const handleApply = () => {
        onApply({
            customer_name: parsedData.customer_name,
            customer_phone: parsedData.customer_phone,
            address: parsedData.address,
            delivery_notes: parsedData.delivery_notes
        });

        setAppliedToast(true);
        setTimeout(() => {
            setAppliedToast(false);
            setIsOpen(false);
        }, 600);
    };

    const hasExtractedData = parsedData.customer_name || parsedData.customer_phone || parsedData.address;

    return (
        <div className={`w-full mb-4 ${className}`}>
            {/* Trigger Bar */}
            {!isOpen ? (
                <div className="flex items-center justify-between p-3 rounded-lg border border-indigo-100 bg-indigo-50/60 hover:bg-indigo-50 transition-colors dark:border-indigo-950/50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/30">
                    <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-md bg-indigo-600 text-white shadow-xs">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="text-xs font-semibold text-indigo-950 dark:text-indigo-200">
                                Smart Address Auto-Fill
                            </span>
                            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/70">
                                Paste chat messages from Messenger / Viber to auto-extract customer info
                            </p>
                        </div>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsOpen(true)}
                        className="h-8 text-xs font-medium border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300"
                    >
                        <Clipboard className="w-3.5 h-3.5 mr-1.5" />
                        Quick Paste
                    </Button>
                </div>
            ) : (
                <div className="rounded-xl border border-indigo-200 bg-white shadow-xs p-4 dark:border-zinc-800 dark:bg-zinc-900 animate-in fade-in duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                Smart Paste & Address Recognizer
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Textarea & Paste Button */}
                    <div className="flex flex-col gap-2 mb-3">
                        <div className="relative">
                            <textarea
                                value={rawText}
                                onChange={(e) => {
                                    setRawText(e.target.value);
                                    setAiSource(null);
                                }}
                                placeholder="Paste raw message here (e.g. Name: Thura, Ph: 09964705459, လိပ်စာ ကန်တော်လေး...)"
                                rows={3}
                                className="w-full text-xs font-sans rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 pr-24 text-zinc-800 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:border-indigo-400 resize-y"
                            />
                            <button
                                type="button"
                                onClick={handlePasteClipboard}
                                className="absolute top-2.5 right-2.5 px-2 py-1 text-[11px] font-medium bg-white text-zinc-700 border border-zinc-200 rounded shadow-2xs hover:bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                            >
                                📋 Paste
                            </button>
                        </div>

                        {/* AI Enhance & Actions Bar */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={!rawText.trim() || isAiLoading}
                                    onClick={handleAiParse}
                                    className="h-7 text-xs border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/30 dark:text-indigo-300"
                                >
                                    {isAiLoading ? (
                                        <>
                                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                            Parsing with AI...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-3 h-3 mr-1 text-indigo-600 dark:text-indigo-400" />
                                            AI Enhance
                                        </>
                                    )}
                                </Button>
                                {aiMessage && (
                                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                                        {aiMessage}
                                    </span>
                                )}
                            </div>

                            {rawText && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRawText('');
                                        setAiSource(null);
                                        setAiMessage(null);
                                    }}
                                    className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Extracted Preview Card */}
                    {hasExtractedData && (
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3 mb-3 dark:border-zinc-800 dark:bg-zinc-950/60">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                                    Extracted Details {aiSource === 'ai' ? '✨ (AI Verified)' : '⚡ (Instant)'}
                                </span>
                                {parsedData.confidence === 'high' && (
                                    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded dark:bg-emerald-950/30 dark:text-emerald-400">
                                        High Confidence
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                <div>
                                    <span className="text-zinc-400 text-[11px]">👤 Name: </span>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {parsedData.customer_name || <span className="text-zinc-400 italic">Not found</span>}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-zinc-400 text-[11px]">📞 Phone: </span>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {parsedData.customer_phone || <span className="text-zinc-400 italic">Not found</span>}
                                    </span>
                                </div>
                                <div className="md:col-span-2">
                                    <span className="text-zinc-400 text-[11px]">📍 Address: </span>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {parsedData.address || <span className="text-zinc-400 italic">Not found</span>}
                                    </span>
                                </div>
                                {parsedData.delivery_notes && (
                                    <div className="md:col-span-2">
                                        <span className="text-zinc-400 text-[11px]">📝 General Note: </span>
                                        <span className="font-medium text-amber-700 dark:text-amber-400">
                                            {parsedData.delivery_notes}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Apply Action Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsOpen(false)}
                            className="h-8 text-xs text-zinc-600 dark:text-zinc-400"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            disabled={!hasExtractedData || appliedToast}
                            onClick={handleApply}
                            className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {appliedToast ? (
                                <>
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                    Applied!
                                </>
                            ) : (
                                <>
                                    <ArrowRight className="w-3.5 h-3.5 mr-1" />
                                    Apply to Order Form
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
