/**
 * Myanmar Address & Customer Info Parser
 * Intelligent client-side rule-based extractor for Myanmar e-commerce chat text.
 */

export interface ParsedCustomerInfo {
    customer_name: string;
    customer_phone: string;
    address: string;
    delivery_notes?: string;
    confidence: 'high' | 'medium' | 'low';
}

// Convert Burmese numbers to English numbers
export function normalizeMyanmarDigits(input: string): string {
    const burmeseDigits = ['၀', '၁', '၂', '၃', '၄', '၅', '၆', '၇', '၈', '၉'];
    let result = input;
    for (let i = 0; i < 10; i++) {
        result = result.replaceAll(burmeseDigits[i], i.toString());
    }
    return result;
}

// List of Myanmar Townships (Yangon, Mandalay, Naypyitaw, and Major Regional Cities)
const MYANMAR_TOWNSHIPS = [
    // Yangon
    'မင်္ဂလာတောင်ညွန့်', 'မင်္ဂလာတောင်ညွှန့်', 'သာကေတ', 'အရှေ့ဒဂုံ', 'တောင်ဒဂုံ', 'မြောက်ဒဂုံ', 'ဒဂုံဆိပ်ကမ်း',
    'လှိုင်သာယာ', 'ရွှေပြည်သာ', 'အင်းစိန်', 'မရမ်းကုန်း', 'လှိုင်', 'ကမာရွတ်', 'ဗဟန်း', 'စမ်းချောင်း',
    'ကျောက်တံတား', 'ပန်းဘဲတန်း', 'လသာ', 'လမ်းမတော်', 'ဒဂုံ', 'အလုံ', 'ကြည့်မြင်တိုင်', 'တာမွေ',
    'ဗိုလ်တထောင်', 'ပုဇွန်တောင်', 'ဒေါပုံ', 'သင်္ဃန်းကျွန်း', 'ရန်ကင်း', 'တောင်ဥက္ကလာပ', 'မြောက်ဥက္ကလာပ',
    'တောင်ဥက္ကလာ', 'မြောက်ဥက္ကလာ', 'သန်လျင်', 'ကျောက်တန်း', 'သုံးခွ', 'ခရမ်း', 'တွံတေး', 'ကော့မှူး',
    'ကွမ်းခြံကုန်း', 'ဆိပ်ကြီးခနောင်တို', 'ဒလ', 'ကန်တော်လေး',
    // Mandalay & Upper Myanmar
    'ချမ်းအေးသာစံ', 'ချမ်းမြသာစည်', 'မဟာအောင်မြေ', 'အောင်မြေသာစံ', 'ပြည်ကြီးတံခွန်', 'အမရပူရ',
    'ပုသိမ်ကြီး', 'ပြင်ဦးလွင်', 'ပြင်ဉီးလွင်', 'မတ္တရာ', 'စဉ့်ကူး', 'ကျောက်ဆည်', 'မြင်းခြံ', 'မိတ္ထီလာ',
    // Naypyitaw
    'နေပြည်တော်', 'ပုဗ္ဗသီရိ', 'ဥတ္တရသီရိ', 'ဇေယျာသီရိ', 'ဇမ္ဗူသီရိ', 'ဒက္ခိဏသီရိ', 'တပ်ကုန်း', 'ပျဉ်းမနား', 'လယ်ဝေး',
    // Major Regional Hubs
    'တောင်ကြီး', 'မော်လမြိုင်', 'ပဲခူး', 'ပုသိမ်', 'မုံရွာ', 'စစ်တွေ', 'မြစ်ကြီးနား', 'လားရှိုး',
    'တောင်ငူ', 'ပြည်', 'မကွေး', 'ဘားအံ', 'ကော့သောင်း', 'ထားဝယ်', 'မြိတ်', 'ရွှေဘို', 'ဗန်းမော်', 'ကျိုင်းတုံ', 'တာချီလိတ်'
];

// Address structural keywords and landmark indicators
const ADDRESS_KEYWORDS = [
    'လမ်း', 'လမ်းသွယ်', 'လမ်းမ', 'လမ်းမကြီး', 'ရပ်ကွက်', 'ကျေးရွာ', 'ရွာ', 'အမှတ်', 'အိမ်အမှတ်',
    'တိုက်', 'အခန်း', 'လွှာ', 'ထပ်', 'ကွန်ဒို', 'တိုက်ခန်း', 'စက်မှုဇုန်', 'ဇုန်', 'ဈေး', 'ဘုရား',
    'ဂိတ်', 'ကားဂိတ်', 'အဝေးပြေးဂိတ်', 'မှတ်တိုင်', 'အနီး', 'ဘေး', 'ရှေ့', 'မျက်နှာချင်းဆိုင်', 'ထောင့်', 'လမ်းဆုံ', 'မြို့နယ်', 'မြို့',
    'အထက', 'အလက', 'အမက', 'ကျောင်း', 'ဆေးရုံ', 'ရုံး',
    'center', 'centre', 'school', 'language', 'hotel', 'plaza', 'tower', 'condo', 'mall', 'mart', 'hospital'
];

// Politeness and filler endings to strip
const POLITE_PARTICLES_REGEX = /(?:\s+)?(?:ပါရှင့်|ပါရှင်|ပါခင်ဗျာ|ပါခင်ဗျ|ပါဗျာ|ပါဗျ|ပါနော်|ပါ့မယ်|ပါ့ရှင့်|ပါ့ခင်ဗျာ|ပါ့|ပါ|ရှင့်|ရှင်|ခင်ဗျာ|ခင်ဗျ|ဗျာ|ဗျ|နော်|လေးပါ|လေးပါရှင့်|လေးပါခင်ဗျာ|မို့လို့ပါ|မို့လို့ပါရှင့်)$/u;

// Conversational sentence starters to strip
const GREETING_STARTER_REGEX = /^(?:ဟုတ်ကဲ့ပါရှင့်|ဟုတ်ကဲ့ပါခင်ဗျာ|ဟုတ်ကဲ့ပါ|ဟုတ်ကဲ့|ဟုတ်|မင်္ဂလာပါရှင့်|မင်္ဂလာပါခင်ဗျာ|မင်္ဂလာပါ|အော်|အမေ|အမရေ|အမ|အစ်မ|ညီမလေး|ညီမ|အကို|အစ်ကို)\s*[၊,\s]*/u;

// Name label prefixes
const NAME_LABEL_REGEX = /^(?:name|customer\s*name|cust\s*name|receiver\s*name|receiver|acc\s*name|account\s*name|နာမည်|အမည်|နာမည်ကတော့|နာမည်က|နာမည်လေးက)[\s\-\:\=]+/i;

// Phone label prefixes
const PHONE_LABEL_REGEX = /^(?:phone(?:\s*number)?|ph(?:\s*no)?|mobile|contact|ဖုန်း(?:\s*နံပါတ်)?|ဖုန်းက|ဖုန်းလေးက|ဆက်သွယ်ရန်ဖုန်း|ဆက်သွယ်ရန်)[\s\-\:\=]+/i;

// Address label prefixes
const ADDRESS_LABEL_REGEX = /^(?:address|addr|delivery\s*address|location|လိပ်စာ|လိပ်စာကတော့|လိပ်စာက|လိပ်စာလေးက|ပို့ပေးရမည့်လိပ်စာ|ပို့ရမည့်လိပ်စာ|ပို့ရန်လိပ်စာ|နေရာ)[\s\-\:\=]+/i;

// Delivery remarks indicators
const REMARK_INDICATORS = [
    'ပို့ပေးပါ', 'ပို့ပါ', 'ဖွင့်ရက်', 'ပိတ်ရက်', 'ရုံးဖွင့်ရက်', 'ကျောင်းဖွင့်ရက်', 'ရုံးချိန်', 'ကျောင်းချိန်',
    'မနက်ပိုင်း', 'ညနေပိုင်း', 'ဖုန်းကြိုဆက်', 'ကြိုဆက်', 'အမြန်ပို့', 'အမြန်', 'မပို့ခင်ဖုန်းဆက်', 'မနက်ဖြန်ပို့',
    'ကားခ', 'တန်ဆာခ', 'ငွေရှင်းပြီး', 'ငွေလွှဲပြီး', 'kpay', 'cod', 'ရှင်းပြီး'
];

/**
 * Clean a single text line by stripping greeting starters and polite particles.
 */
export function cleanTextValue(val: string): string {
    let clean = val.trim();
    clean = clean.replace(GREETING_STARTER_REGEX, '');
    clean = clean.replace(POLITE_PARTICLES_REGEX, '');
    return clean.trim();
}

/**
 * Main parser function to extract customer info from raw chat text.
 */
export function parseMyanmarAddress(rawInput: string): ParsedCustomerInfo {
    if (!rawInput || !rawInput.trim()) {
        return { customer_name: '', customer_phone: '', address: '', confidence: 'low' };
    }

    // 1. Normalize numbers
    const normalized = normalizeMyanmarDigits(rawInput);

    let extractedPhone = '';
    let extractedName = '';
    const addressLines: string[] = [];
    const remarkLines: string[] = [];

    // 2. Extract Phone Number
    // Myanmar format: 09XXXXXXXXX, +959XXXXXXXXX, 09-XXXXXXXX, etc.
    const phoneRegex = /(?:\+?95\s*9|0\s*9)[\s\-\.]*(\d[\s\-\.]*){7,9}\b/g;
    const phoneMatches = [...normalized.matchAll(phoneRegex)];

    if (phoneMatches.length > 0) {
        const cleanedPhones: string[] = [];
        for (const match of phoneMatches) {
            const rawPhone = match[0];
            let cleanedPhone = rawPhone.replace(/[\s\-\.\+]/g, '');
            if (cleanedPhone.startsWith('959')) {
                cleanedPhone = '09' + cleanedPhone.slice(3);
            } else if (!cleanedPhone.startsWith('09') && cleanedPhone.startsWith('9')) {
                cleanedPhone = '0' + cleanedPhone;
            }
            if (!cleanedPhones.includes(cleanedPhone)) {
                cleanedPhones.push(cleanedPhone);
            }
        }
        extractedPhone = cleanedPhones.join(', ');
    }

    // 3. Process line by line
    const lines = normalized
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

    const unassignedLines: string[] = [];

    for (let line of lines) {
        // Strip out phone number from line
        let lineWithoutPhone = line;
        if (phoneRegex.test(lineWithoutPhone)) {
            lineWithoutPhone = lineWithoutPhone.replace(phoneRegex, ' ').trim();
        }

        let cleanedLine = cleanTextValue(lineWithoutPhone);
        if (!cleanedLine) continue;

        // Check for Explicit Name Label
        if (NAME_LABEL_REGEX.test(cleanedLine)) {
            const nameVal = cleanedLine.replace(NAME_LABEL_REGEX, '');
            extractedName = cleanTextValue(nameVal);
            continue;
        }

        // Check for Explicit Phone Label
        if (PHONE_LABEL_REGEX.test(line)) {
            if (!extractedPhone) {
                const phVal = line.replace(PHONE_LABEL_REGEX, '').replace(/[\s\-\.\+]/g, '');
                if (phVal) extractedPhone = phVal;
            }
            continue;
        }

        // Check for Explicit Address Label
        if (ADDRESS_LABEL_REGEX.test(cleanedLine)) {
            const addrVal = cleanedLine.replace(ADDRESS_LABEL_REGEX, '');
            const cleanedAddr = cleanTextValue(addrVal);
            if (cleanedAddr) addressLines.push(cleanedAddr);
            continue;
        }

        // Check for Delivery Remarks / Instructions
        const isRemark = REMARK_INDICATORS.some(kw => cleanedLine.includes(kw));
        if (isRemark && !cleanedLine.includes('လမ်း') && !cleanedLine.includes('မြို့နယ်')) {
            remarkLines.push(cleanTextValue(cleanedLine));
            continue;
        }

        const lowerCleaned = cleanedLine.toLowerCase();
        const containsTownship = MYANMAR_TOWNSHIPS.some(t => cleanedLine.includes(t));
        const containsAddressKw = ADDRESS_KEYWORDS.some(kw => lowerCleaned.includes(kw));

        if (containsTownship || containsAddressKw) {
            addressLines.push(cleanedLine);
        } else {
            unassignedLines.push(cleanedLine);
        }
    }

    // 4. Handle Unassigned Lines
    if (!extractedName && unassignedLines.length > 0) {
        // Find best candidate for Name:
        // Prefers lines that are short (<= 35 chars) and do not look like building/street landmarks
        const nameIdx = unassignedLines.findIndex(l => l.length <= 35 && !l.includes('လမ်း'));
        if (nameIdx !== -1) {
            extractedName = cleanTextValue(unassignedLines[nameIdx]);
            unassignedLines.splice(nameIdx, 1);
        } else {
            const possibleName = unassignedLines.shift();
            if (possibleName) extractedName = cleanTextValue(possibleName);
        }
    }

    // Any remaining unassigned lines are added to address
    for (const rem of unassignedLines) {
        if (rem.length > 0) {
            addressLines.push(rem);
        }
    }

    // 5. Build final address
    let finalAddress = addressLines.join(' ').replace(/\s+/g, ' ').trim();
    finalAddress = cleanTextValue(finalAddress);

    if (extractedName) {
        extractedName = cleanTextValue(extractedName);
    }

    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (!extractedPhone || !extractedName || !finalAddress) {
        confidence = (!extractedPhone && !extractedName && !finalAddress) ? 'low' : 'medium';
    }

    return {
        customer_name: extractedName,
        customer_phone: extractedPhone,
        address: finalAddress,
        delivery_notes: remarkLines.join(', '),
        confidence
    };
}
