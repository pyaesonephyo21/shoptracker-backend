import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { parseMyanmarAddress, ParsedCustomerInfo } from '@/lib/addressParser';
import {
    Sparkles,
    Clipboard,
    Check,
    X,
    Loader2,
    ArrowRight,
    Camera,
    Image as ImageIcon,
    Trash2,
    FileImage
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SmartAddressPasteProps {
    onApply: (data: {
        customer_name: string;
        customer_phone: string;
        delivery_address: string;
        delivery_notes?: string;
    }) => void;
    className?: string;
}

interface SelectedImageState {
    previewUrl: string;
    base64: string;
    mime: string;
    name: string;
    sizeKb: number;
}

export default function SmartAddressPaste({ onApply, className = '' }: SmartAddressPasteProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [rawText, setRawText] = useState('');
    const [selectedImage, setSelectedImage] = useState<SelectedImageState | null>(null);
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
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Live instant parsing via local regex/heuristics on text change
    useEffect(() => {
        if (!rawText.trim() && !selectedImage) {
            setParsedData({ customer_name: '', customer_phone: '', address: '', confidence: 'low' });
            setAiSource(null);
            setAiMessage(null);
            return;
        }

        // Only parse locally if text changed and not currently showing AI result and no image is attached
        if (aiSource !== 'ai' && !selectedImage && rawText.trim()) {
            const localResult = parseMyanmarAddress(rawText);
            setParsedData(localResult);
            setAiSource('local');
        }
    }, [rawText, selectedImage, aiSource]);

    const processImageFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            setAiMessage('Please select a valid image file (PNG, JPG, WEBP).');
            return;
        }

        if (file.size > 15 * 1024 * 1024) {
            setAiMessage('Image size exceeds 15MB limit.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result;
            if (typeof result !== 'string') return;

            const img = new Image();
            img.onload = () => {
                try {
                    const MAX_DIMENSION = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height && width > MAX_DIMENSION) {
                        height = Math.round((height * MAX_DIMENSION) / width);
                        width = MAX_DIMENSION;
                    } else if (height > MAX_DIMENSION) {
                        width = Math.round((width * MAX_DIMENSION) / height);
                        height = MAX_DIMENSION;
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);

                        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
                        const base64Index = compressedDataUrl.indexOf(';base64,');
                        const base64Data = base64Index !== -1 ? compressedDataUrl.substring(base64Index + 8) : compressedDataUrl;
                        const sizeKb = Math.round((base64Data.length * 3) / 4 / 1024);

                        setSelectedImage({
                            previewUrl: compressedDataUrl,
                            base64: base64Data,
                            mime: 'image/jpeg',
                            name: file.name || 'Pasted-Screenshot.jpg',
                            sizeKb
                        });
                        setAiMessage(`📷 Photo optimized (${sizeKb} KB). Tap "Extract with AI" to parse.`);
                        return;
                    }
                } catch (canvasErr) {
                    console.warn('Canvas compression failed, falling back to raw image:', canvasErr);
                }

                // Fallback to raw base64 if canvas processing fails
                const mime = file.type || 'image/jpeg';
                const base64Index = result.indexOf(';base64,');
                const base64Data = base64Index !== -1 ? result.substring(base64Index + 8) : result;

                setSelectedImage({
                    previewUrl: result,
                    base64: base64Data,
                    mime,
                    name: file.name || 'Pasted-Screenshot.png',
                    sizeKb: Math.round(file.size / 1024)
                });
                setAiMessage('📷 Photo attached. Tap "Extract with AI" to parse.');
            };

            img.onerror = () => {
                setAiMessage('Could not read image. Please try another image.');
            };

            img.src = result;
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processImageFile(file);
        }
        if (e.target) e.target.value = '';
    };

    const handleRemoveImage = () => {
        setSelectedImage(null);
        if (!rawText.trim()) {
            setParsedData({ customer_name: '', customer_phone: '', address: '', confidence: 'low' });
            setAiSource(null);
            setAiMessage(null);
        } else {
            const localResult = parseMyanmarAddress(rawText);
            setParsedData(localResult);
            setAiSource('local');
            setAiMessage(null);
        }
    };

    // Handle 1-tap clipboard paste (prioritizes text, with graceful fallback for image)
    const handlePasteClipboard = async () => {
        try {
            // 1. Try reading text first (standard clipboard text API, widely supported across iOS/Android/Desktop)
            if (navigator.clipboard?.readText) {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text && text.trim()) {
                        setRawText(text);
                        setAiSource(null);
                        setAiMessage(null);
                        return;
                    }
                } catch (textErr) {
                    console.warn('readText failed, trying read():', textErr);
                }
            }

            // 2. If no text was found or text failed, check if an image is in clipboard
            if (navigator.clipboard?.read) {
                try {
                    const items = await navigator.clipboard.read();
                    for (const item of items) {
                        const imageType = item.types.find(t => t.startsWith('image/'));
                        if (imageType) {
                            const blob = await item.getType(imageType);
                            const file = new File([blob], 'clipboard-image.png', { type: imageType });
                            processImageFile(file);
                            return;
                        }
                    }
                } catch (imageErr) {
                    console.warn('Clipboard read() failed:', imageErr);
                }
            }

            setAiMessage('Clipboard is empty. Please copy a message or photo first.');
        } catch (err: unknown) {
            console.warn('Clipboard paste failed:', err);
            setAiMessage('Please paste manually using Ctrl+V or long-press paste.');
        }
    };

    const handleContainerPaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image/')) {
                    const file = items[i].getAsFile();
                    if (file) {
                        e.preventDefault();
                        processImageFile(file);
                        return;
                    }
                }
            }
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                processImageFile(file);
            }
        }
    };

    // Handle Multimodal AI Parsing
    const handleAiParse = async () => {
        if (!rawText.trim() && !selectedImage) return;

        setIsAiLoading(true);
        setAiMessage(null);

        try {
            const payload: { text?: string; image_base64?: string; image_mime?: string } = {};
            if (rawText.trim()) {
                payload.text = rawText.trim();
            }
            if (selectedImage) {
                payload.image_base64 = selectedImage.base64;
                payload.image_mime = selectedImage.mime;
            }

            const response = await axios.post('/api/ai/parse-address', payload);
            if (response.data && response.data.success && response.data.data) {
                const aiData = response.data.data;
                setParsedData({
                    customer_name: aiData.customer_name || '',
                    customer_phone: aiData.customer_phone || '',
                    address: aiData.delivery_address || aiData.address || '',
                    delivery_notes: aiData.delivery_notes || '',
                    confidence: 'high'
                });
                setAiSource('ai');
                setAiMessage(selectedImage ? '✨ Photo & text parsed with AI' : '✨ Enhanced with AI');
            } else {
                if (rawText.trim()) {
                    const localResult = parseMyanmarAddress(rawText);
                    setParsedData(localResult);
                    setAiSource('local');
                }
                setAiMessage(response.data?.message || 'Using smart local parser (AI key not set).');
            }
        } catch (err: unknown) {
            console.error('AI Parse error:', err);
            if (rawText.trim()) {
                const localResult = parseMyanmarAddress(rawText);
                setParsedData(localResult);
                setAiSource('local');
            }
            setAiMessage('AI service temporarily unreachable.');
        } finally {
            setIsAiLoading(false);
        }
    };

    // Handle Apply to Form
    const handleApply = () => {
        onApply({
            customer_name: parsedData.customer_name,
            customer_phone: parsedData.customer_phone,
            delivery_address: parsedData.address,
            delivery_notes: parsedData.delivery_notes
        });

        setAppliedToast(true);
        setTimeout(() => {
            setAppliedToast(false);
            setIsOpen(false);
        }, 600);
    };

    const hasExtractedData = Boolean(
        parsedData.customer_name || parsedData.customer_phone || parsedData.address
    );

    return (
        <div className={`w-full mb-4 ${className}`} onPaste={handleContainerPaste}>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
            />

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
                                Paste chat text or upload photo / waybill slip to auto-fill customer info
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setIsOpen(true);
                                setTimeout(() => fileInputRef.current?.click(), 100);
                            }}
                            className="h-8 text-xs font-medium border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300"
                        >
                            <Camera className="w-3.5 h-3.5 mr-1" />
                            Photo
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setIsOpen(true);
                                handlePasteClipboard();
                            }}
                            className="h-8 text-xs font-medium border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-zinc-900 dark:text-indigo-300"
                        >
                            <Clipboard className="w-3.5 h-3.5 mr-1" />
                            Quick Paste
                        </Button>
                    </div>
                </div>
            ) : (
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`rounded-xl border bg-white shadow-xs p-4 dark:border-zinc-800 dark:bg-zinc-900 transition-colors ${
                        isDragging ? 'border-indigo-500 bg-indigo-50/20' : 'border-indigo-200'
                    }`}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800 mb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                Smart Address & Photo Parser
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
                    <div className="flex flex-col gap-2.5 mb-3">
                        <div className="relative">
                            <textarea
                                value={rawText}
                                onChange={(e) => {
                                    setRawText(e.target.value);
                                    setAiSource(null);
                                }}
                                placeholder="Paste raw message here, or drag & drop / paste a photo/screenshot of the voucher or chat slip..."
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

                        {/* Image Preview Card */}
                        {selectedImage && (
                            <div className="flex items-center justify-between p-2.5 rounded-lg border border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                                <div className="flex items-center gap-3 min-w-0">
                                    <img
                                        src={selectedImage.previewUrl}
                                        alt="Voucher slip preview"
                                        className="w-12 h-12 object-cover rounded-md border border-zinc-200 dark:border-zinc-700 shrink-0"
                                    />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <FileImage className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                            <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                                {selectedImage.name}
                                            </span>
                                            <span className="text-[10px] text-zinc-500 shrink-0">
                                                ({selectedImage.sizeKb} KB)
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80">
                                            Photo attached for AI OCR & customer extraction
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleRemoveImage}
                                    className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400 shrink-0"
                                    title="Remove photo"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* AI Enhance & Actions Bar */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    disabled={(!rawText.trim() && !selectedImage) || isAiLoading}
                                    onClick={handleAiParse}
                                    className="h-8 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                                >
                                    {isAiLoading ? (
                                        <>
                                            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                            Parsing with AI...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-3 h-3 mr-1.5" />
                                            {selectedImage ? 'Extract from Photo & Text' : 'AI Enhance'}
                                        </>
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-8 text-xs border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                >
                                    <Camera className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                                    {selectedImage ? 'Change Photo' : 'Upload Photo / Slip'}
                                </Button>

                                {aiMessage && (
                                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                                        {aiMessage}
                                    </span>
                                )}
                            </div>

                            {(rawText || selectedImage) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRawText('');
                                        setSelectedImage(null);
                                        setAiSource(null);
                                        setAiMessage(null);
                                        setParsedData({ customer_name: '', customer_phone: '', address: '', confidence: 'low' });
                                    }}
                                    className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                                >
                                    Clear all
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
                                    <span className="text-zinc-400 text-[11px]">📍 Delivery Address: </span>
                                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                                        {parsedData.address || <span className="text-zinc-400 italic">Not found</span>}
                                    </span>
                                </div>
                                {parsedData.delivery_notes && (
                                    <div className="md:col-span-2">
                                        <span className="text-zinc-400 text-[11px]">📝 Delivery Notes: </span>
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
