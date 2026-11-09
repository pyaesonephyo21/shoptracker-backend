<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\ProductVariant;

class SkuGeneratorService
{
    public function generateBaseCode(string $productName, ?int $shopId = null, ?string $categoryName = null): string
    {
        $acronym = $this->generateAcronym($productName, $categoryName);
        $seq = $this->resolveNextSequence($acronym, $shopId);

        return $acronym.$seq;
    }

    public function generateAcronym(string $productName, ?string $categoryName = null): string
    {
        $cleaned = preg_replace('/[^\p{L}\p{N}\s\-]/u', '', $productName);
        $cleaned = trim((string) $cleaned);

        $latinOnly = preg_replace('/[^a-zA-Z\s\-]/', '', $cleaned);
        $words = array_values(array_filter(preg_split('/[\s\-]+/', trim((string) $latinOnly))));

        if (empty($words)) {
            if ($categoryName) {
                $catClean = preg_replace('/[^a-zA-Z]/', '', $categoryName);
                if (strlen($catClean) >= 3) {
                    return strtoupper(substr($catClean, 0, 3));
                }
            }

            return 'PRD';
        }

        if (count($words) >= 3) {
            $letters = '';
            foreach (array_slice($words, 0, 4) as $w) {
                $letters .= strtoupper($w[0]);
            }

            return $letters;
        }

        if (count($words) === 2) {
            $w1 = strtoupper($words[0]);
            $w2 = strtoupper($words[1]);
            $p1 = strlen($w1) >= 2 ? substr($w1, 0, 2) : $w1;
            $p2 = strlen($w2) >= 2 ? substr($w2, 0, 2) : $w2;

            return $p1.$p2;
        }

        $w = strtoupper($words[0]);

        return strlen($w) >= 4 ? substr($w, 0, 4) : (strlen($w) >= 3 ? substr($w, 0, 3) : str_pad($w, 3, 'X'));
    }

    public function resolveNextSequence(string $acronym, ?int $shopId = null): string
    {
        $query = ProductVariant::query();
        if ($shopId) {
            $query->whereHas('product', function ($q) use ($shopId) {
                $q->where('shop_id', $shopId);
            });
        }

        $pattern = $acronym.'%';
        $existingSkus = $query->where('sku', 'like', $pattern)->pluck('sku');

        $maxSeq = 0;
        $regex = '/^'.preg_quote($acronym, '/').'(\d{2,})/';
        foreach ($existingSkus as $sku) {
            if ($sku && preg_match($regex, $sku, $matches)) {
                $seq = (int) $matches[1];
                if ($seq > $maxSeq) {
                    $maxSeq = $seq;
                }
            }
        }

        $nextSeq = $maxSeq + 1;

        return str_pad((string) $nextSeq, 2, '0', STR_PAD_LEFT);
    }

    public function formatAttributeValue(mixed $value): string
    {
        $str = trim((string) ($value ?? ''));
        if ($str === '') {
            return 'DEF';
        }

        $clean = preg_replace('/[^\p{L}\p{M}\p{N}\-]/u', '', $str);
        if ($clean === '' || $clean === null) {
            return 'DEF';
        }

        return mb_strtoupper((string) $clean, 'UTF-8');
    }

    public function generateVariantSku(string $baseCode, array $attributes): string
    {
        if (empty($attributes)) {
            return $baseCode.'-DEF';
        }

        $parts = [];
        foreach ($attributes as $val) {
            $parts[] = $this->formatAttributeValue($val);
        }

        return $baseCode.'-'.implode('-', $parts);
    }
}
