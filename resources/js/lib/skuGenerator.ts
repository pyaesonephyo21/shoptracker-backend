export function generateAcronym(productName: string, categoryName?: string): string {
    const trimmed = (productName || '').trim();
    if (!trimmed) {
        if (categoryName && categoryName.trim().length >= 3) {
            return categoryName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'PRD';
        }
        return 'PRD';
    }

    const latinOnly = trimmed.replace(/[^a-zA-Z\s\-]/g, '');
    const words = latinOnly.split(/[\s\-]+/).filter(Boolean);

    if (words.length === 0) {
        if (categoryName && categoryName.trim().length >= 3) {
            return categoryName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'PRD';
        }
        return 'PRD';
    }

    if (words.length >= 3) {
        return words.slice(0, 4).map(w => w[0].toUpperCase()).join('');
    }

    if (words.length === 2) {
        const p1 = words[0].length >= 2 ? words[0].substring(0, 2) : words[0];
        const p2 = words[1].length >= 2 ? words[1].substring(0, 2) : words[1];
        return (p1 + p2).toUpperCase();
    }

    const single = words[0].toUpperCase();
    if (single.length >= 4) {
        return single.substring(0, 4);
    }
    if (single.length >= 3) {
        return single.substring(0, 3);
    }
    return single.padEnd(3, 'X');
}

export function formatAttributeValue(value: string | number | null | undefined): string {
    const str = String(value ?? '').trim();
    if (!str) {
        return 'DEF';
    }

    // Use the actual input data dynamically, cleaning punctuation while preserving Unicode letters, marks/diacritics, numbers, and hyphens
    const clean = str.replace(/[^\p{L}\p{M}\p{N}\-]/gu, '');
    if (!clean) {
        return 'DEF';
    }

    return clean.toUpperCase();
}

export function buildVariantSku(baseCode: string, attributes?: Record<string, string>): string {
    const cleanBase = (baseCode || 'PRD01').trim().toUpperCase();
    const values = Object.values(attributes || {});

    if (values.length === 0) {
        return `${cleanBase}-DEF`;
    }

    const suffix = values.map(v => formatAttributeValue(v)).join('-');
    return `${cleanBase}-${suffix}`;
}
