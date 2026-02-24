const cleanText = (text) => {
    if (!text) return '';

    let cleaned = text;

    // Fix Dari (।) OCR errors: || and | often misread
    cleaned = cleaned.replace(/\|\|/g, '।');
    cleaned = cleaned.replace(/ \| /g, ' । ');

    // Fix spacing around Dari
    cleaned = cleaned.replace(/\s+।/g, '।');
    cleaned = cleaned.replace(/।([^\s\n])/g, '। $1');

    // Normalize whitespace (preserve newlines)
    cleaned = cleaned.replace(/[ \t]+/g, ' ');

    // Fix o/O misread as Bengali zero ০ near Bengali digits
    cleaned = cleaned.replace(/([০-৯])[oO]([০-৯])/g, '$1০$2');
    cleaned = cleaned.replace(/([০-৯])[oO]/g, '$1০');
    cleaned = cleaned.replace(/[oO]([০-৯])/g, '০$1');

    // Fix l/1/I/| misread as Danda between Bengali chars
    cleaned = cleaned.replace(/([\u0980-\u09FF])\s+[lI|1]\s+([\u0980-\u09FF])/g, '$1 । $2');

    // Fix broken composites: অ + া -> আ
    cleaned = cleaned.replace(/অ\s*া/g, 'আ');

    // Remove spaces around Hasant ্
    cleaned = cleaned.replace(/\s+্/g, '্');
    cleaned = cleaned.replace(/্\s+/g, '্');

    // Fix 8 misread as ৪ near Bengali digits
    cleaned = cleaned.replace(/([০-৯])8/g, '$1৪');
    cleaned = cleaned.replace(/8([০-৯])/g, '৪$1');

    // Fix q misread as ৭ near Bengali digits
    cleaned = cleaned.replace(/([০-৯])q/g, '$1৭');
    cleaned = cleaned.replace(/q([০-৯])/g, '৭$1');

    // Remove isolated noise symbols
    cleaned = cleaned.replace(/\s+[\\^_~]\s+/g, ' ');

    return cleaned.trim();
};

module.exports = {
    cleanText
};
