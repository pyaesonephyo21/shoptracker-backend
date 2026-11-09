<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ProductVariant;
use App\Models\SalesOrder;
use App\Models\Shop;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class TelegramOrderProcessorService
{
    public function __construct(
        private readonly TelegramService $telegramService,
        private readonly AiAddressParserService $parserService,
        private readonly SalesOrderService $salesOrderService
    ) {}

    /**
     * Process an incoming Telegram message to parse and create a Sales Order.
     *
     * @param  array<string, mixed>  $messageData
     */
    public function process(int $shopId, array $messageData): ?SalesOrder
    {
        try {
            $shop = Shop::find($shopId);
            if (! $shop) {
                Log::error("Shop #{$shopId} not found when processing Telegram order.");

                return null;
            }

            $chatId = $messageData['chat']['id'] ?? null;
            $messageId = isset($messageData['message_id']) ? (int) $messageData['message_id'] : null;
            $chatType = (string) ($messageData['chat']['type'] ?? '');

            if (! $chatId) {
                Log::warning('Telegram message missing chat ID', ['data' => $messageData]);

                return null;
            }

            $mediaGroupId = isset($messageData['media_group_id']) ? (string) $messageData['media_group_id'] : null;
            if ($mediaGroupId && Cache::has("tg_media_group_done:{$mediaGroupId}")) {
                return null;
            }

            $fileId = $this->extractPhotoFileId($messageData);
            $caption = trim((string) ($messageData['caption'] ?? $messageData['text'] ?? ''));

            if (empty($caption) && ! empty($messageData['reply_to_message']) && is_array($messageData['reply_to_message'])) {
                $replyMsg = $messageData['reply_to_message'];
                $caption = trim((string) ($replyMsg['caption'] ?? $replyMsg['text'] ?? ''));
            }

            if (! $fileId) {
                $isPrivate = $chatType === 'private';
                $isCommand = str_starts_with($caption, '/');

                if ($isPrivate || $isCommand || ! empty($caption)) {
                    $this->telegramService->sendMessage(
                        $chatId,
                        '⚠️ Please send a customer chat screenshot together with the product caption (e.g. <i>Infinity Silver 1</i>).',
                        $messageId,
                        'HTML',
                        $shop->telegram_bot_token
                    );
                }

                return null;
            }

            if ($mediaGroupId && empty($caption)) {
                if (! Cache::add("tg_media_group_warned:{$mediaGroupId}", true, 60)) {
                    return null;
                }
            }

            $downloaded = $this->telegramService->downloadFile($fileId, $shop->telegram_bot_token);
            if (! $downloaded) {
                $this->telegramService->sendMessage(
                    $chatId,
                    '⚠️ Failed to download the screenshot from Telegram. Please try sending again.',
                    $messageId,
                    'HTML',
                    $shop->telegram_bot_token
                );

                return null;
            }

            $candidateVariants = ProductVariant::query()
                ->whereHas('product', function ($query) use ($shop): void {
                    $query->where('shop_id', $shop->id)
                        ->where('is_active', true);
                })
                ->with('product:id,name,retail_price')
                ->get()
                ->map(fn (ProductVariant $variant): array => [
                    'id' => $variant->id,
                    'product_name' => $variant->product?->name ?? 'Unknown',
                    'variant_sku' => $variant->sku,
                    'attributes' => $variant->attributes ?? [],
                    'price' => (float) $variant->effective_retail_price,
                    'stock_quantity' => (int) $variant->stock_quantity,
                ])
                ->values()
                ->toArray();

            if (empty($candidateVariants)) {
                $this->telegramService->sendMessage(
                    $chatId,
                    '⚠️ No active products found in your shop inventory to match orders against.',
                    $messageId,
                    'HTML',
                    $shop->telegram_bot_token
                );

                return null;
            }

            $imageBase64 = base64_encode($downloaded['content']);
            $imageMimeType = $downloaded['mime_type'];

            $parseResult = $this->parserService->parseOrder(
                $caption,
                $imageBase64,
                $imageMimeType,
                $candidateVariants
            );

            if (! ($parseResult['success'] ?? false)) {
                $reason = htmlspecialchars((string) ($parseResult['message'] ?? 'Could not parse screenshot'), ENT_QUOTES, 'UTF-8');
                $this->telegramService->sendMessage(
                    $chatId,
                    "⚠️ <b>Order Parsing Failed</b>\n\n{$reason}",
                    $messageId,
                    'HTML',
                    $shop->telegram_bot_token
                );

                return null;
            }

            $parsedData = $parseResult['data'] ?? [];
            $items = $parsedData['items'] ?? [];

            if (empty($items)) {
                $safeCaption = htmlspecialchars($caption, ENT_QUOTES, 'UTF-8');
                $this->telegramService->sendMessage(
                    $chatId,
                    "⚠️ Could not match any active product variant from caption: \"{$safeCaption}\". Please check your product names/variants in inventory.",
                    $messageId,
                    'HTML',
                    $shop->telegram_bot_token
                );

                return null;
            }

            $variantIds = array_column($items, 'product_variant_id');
            $uniqueVariantIds = array_values(array_unique($variantIds));
            $validVariantsCount = ProductVariant::query()
                ->whereIn('id', $uniqueVariantIds)
                ->whereHas('product', fn ($q) => $q->where('shop_id', $shop->id))
                ->count();

            if ($validVariantsCount !== count($uniqueVariantIds)) {
                Log::warning('Unauthorized product variant access detected in Telegram order', [
                    'shop_id' => $shop->id,
                    'variant_ids' => $variantIds,
                ]);

                $this->telegramService->sendMessage(
                    $chatId,
                    '⚠️ One or more selected products do not belong to this shop.',
                    $messageId,
                    'HTML',
                    $shop->telegram_bot_token
                );

                return null;
            }

            // Consolidate identical variants into aggregated quantities
            $consolidated = [];
            foreach ($items as $item) {
                $vid = (int) $item['product_variant_id'];
                $qty = max(1, (int) ($item['quantity'] ?? 1));
                $consolidated[$vid] = ($consolidated[$vid] ?? 0) + $qty;
            }

            $orderItems = [];
            foreach ($consolidated as $vid => $qty) {
                $orderItems[] = [
                    'product_variant_id' => $vid,
                    'quantity' => $qty,
                ];
            }

            $customerName = trim((string) ($parsedData['customer_name'] ?? ''));
            $orderData = [
                'shop_id' => $shop->id,
                'customer_name' => ! empty($customerName) ? $customerName : 'Guest',
                'customer_phone' => (string) ($parsedData['customer_phone'] ?? ''),
                'delivery_address' => (string) ($parsedData['delivery_address'] ?? ''),
                'delivery_note' => (string) ($parsedData['delivery_notes'] ?? ''),
                'paid_amount' => (float) ($parsedData['paid_amount'] ?? 0),
                'note' => 'Created automatically from Telegram',
            ];

            $order = $this->salesOrderService->createOrder($orderData, $orderItems);

            if ($mediaGroupId) {
                Cache::put("tg_media_group_done:{$mediaGroupId}", true, now()->addMinutes(10));
            }

            $orderUrl = rtrim((string) config('app.url', 'http://localhost:8088'), '/').'/sales/'.$order->id;
            $confirmationMessage = $this->formatOrderSummary($order, $orderUrl, $shop->currency_code ?? 'MMK');

            $this->telegramService->sendMessage(
                $chatId,
                $confirmationMessage,
                $messageId,
                'HTML',
                $shop->telegram_bot_token
            );

            return $order;
        } catch (Throwable $e) {
            Log::error('Sales order creation failed for Telegram order: '.$e->getMessage(), [
                'shop_id' => $shopId,
                'chat_id' => $messageData['chat']['id'] ?? null,
                'exception' => $e,
            ]);

            $chatId = $messageData['chat']['id'] ?? null;
            $messageId = isset($messageData['message_id']) ? (int) $messageData['message_id'] : null;

            if ($chatId) {
                $safeError = htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8');
                $this->telegramService->sendMessage(
                    $chatId,
                    "⚠️ <b>Could Not Create Order</b>\n\nReason: {$safeError}",
                    $messageId,
                    'HTML',
                    isset($shop) ? $shop->telegram_bot_token : null
                );
            }

            return null;
        }
    }

    /**
     * @param  array<string, mixed>  $messageData
     */
    private function extractPhotoFileId(array $messageData): ?string
    {
        $fileId = $this->resolveDirectPhotoFileId($messageData);
        if ($fileId) {
            return $fileId;
        }

        if (isset($messageData['reply_to_message']) && is_array($messageData['reply_to_message'])) {
            return $this->resolveDirectPhotoFileId($messageData['reply_to_message']);
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $msg
     */
    private function resolveDirectPhotoFileId(array $msg): ?string
    {
        $photos = $msg['photo'] ?? [];
        if (is_array($photos) && ! empty($photos)) {
            $largest = end($photos);

            return is_array($largest) ? ($largest['file_id'] ?? null) : null;
        }

        $document = $msg['document'] ?? null;
        if (is_array($document)) {
            $mime = (string) ($document['mime_type'] ?? '');
            if (str_starts_with($mime, 'image/')) {
                return $document['file_id'] ?? null;
            }
        }

        return null;
    }

    public function formatOrderSummary(SalesOrder $order, string $orderUrl, string $currency): string
    {
        $safeName = htmlspecialchars((string) ($order->customer_name ?? 'Guest'), ENT_QUOTES, 'UTF-8');
        $safePhone = htmlspecialchars((string) ($order->customer_phone ?? '-'), ENT_QUOTES, 'UTF-8');
        $safeAddress = htmlspecialchars((string) ($order->delivery_address ?? '-'), ENT_QUOTES, 'UTF-8');
        $safeNotes = htmlspecialchars((string) ($order->delivery_note ?? ''), ENT_QUOTES, 'UTF-8');
        $safeUrl = htmlspecialchars($orderUrl, ENT_QUOTES, 'UTF-8');

        // Group multiple batch-split line items by product variant ID
        $groupedItems = [];
        foreach ($order->items as $item) {
            $variantId = $item->product_variant_id;
            if (! isset($groupedItems[$variantId])) {
                $productName = $item->productVariant?->product?->name ?? 'Product';
                $sku = $item->productVariant?->sku ?? '';
                $label = $sku ? "{$productName} ({$sku})" : $productName;

                $groupedItems[$variantId] = [
                    'label' => $label,
                    'quantity' => 0,
                    'unit_price' => (float) $item->unit_price,
                ];
            }
            $groupedItems[$variantId]['quantity'] += $item->quantity;
        }

        $itemLines = [];
        foreach ($groupedItems as $grouped) {
            $safeLabel = htmlspecialchars($grouped['label'], ENT_QUOTES, 'UTF-8');
            $qty = $grouped['quantity'];
            $unitPrice = number_format($grouped['unit_price']);
            $itemLines[] = "• {$safeLabel} × {$qty} ({$unitPrice} {$currency})";
        }

        $itemsText = ! empty($itemLines) ? implode("\n", $itemLines) : '• -';
        $grandTotal = (float) $order->customer_grand_total;
        $paidAmount = (float) $order->paid_amount;
        $remaining = max(0.0, $grandTotal - $paidAmount);
        $totalText = number_format($grandTotal).' '.$currency;

        $message = "✅ <b>Order Created Successfully!</b>\n\n";
        $message .= "📦 <b>Order ID:</b> #{$order->id}\n";
        $message .= "👤 <b>Customer:</b> {$safeName}\n";
        $message .= "📞 <b>Phone:</b> {$safePhone}\n";
        $message .= "📍 <b>Address:</b> {$safeAddress}\n";

        if (! empty($safeNotes)) {
            $message .= "📝 <b>Notes:</b> {$safeNotes}\n";
        }

        $message .= "\n🛍️ <b>Items:</b>\n{$itemsText}\n\n";
        $message .= "💰 <b>Total:</b> <b>{$totalText}</b>\n";

        if ($paidAmount > 0) {
            if ($remaining <= 0.0) {
                $paidFormatted = number_format($paidAmount).' '.$currency;
                $message .= "💳 <b>Paid:</b> <b>{$paidFormatted}</b> (Fully Paid)\n";
            } else {
                $prepaidFormatted = number_format($paidAmount).' '.$currency;
                $remainingFormatted = number_format($remaining).' '.$currency;
                $message .= "💳 <b>Prepaid:</b> <b>{$prepaidFormatted}</b>\n";
                $message .= "💵 <b>Remaining COD:</b> <b>{$remainingFormatted}</b>\n";
            }
        }

        $message .= "\n🔗 <a href=\"{$safeUrl}\">View Order #{$order->id}</a>";

        return $message;
    }
}
