/**
 * Cleans and corrects text using regex-based rules.
 * Focuses on safe corrections like spacing and common OCR punctuation errors.
 * 
 * @param {string} text - The raw OCR text.
 * @returns {string} - The cleaned text.
 */
const cleanText = (text) => {
    if (!text) return '';

    let cleaned = text;

    // 1. Fix common Dari (Full stop) OCR errors
    // Double pipes '||' often appear instead of '।'
    cleaned = cleaned.replace(/\|\|/g, '।');

    // Single pipe '|' often appears instead of '।'
    // Be careful with this if vertical bars are legitimate (e.g. math), but in general text it's usually Dari.
    // We can limit this to cases surrounded by spaces or Bangla chars if needed.
    // For now, let's assume loose text.
    cleaned = cleaned.replace(/ \| /g, ' । ');

    // 2. Fix spacing variations
    // Remove spaces before Dari
    cleaned = cleaned.replace(/\s+।/g, '।');
    // Ensure space after Dari (if not end of line)
    cleaned = cleaned.replace(/।([^\s\n])/g, '। $1');

    // 3. Normalize whitespace to single spaces (preserve newlines)
    // Replace multiple spaces (but not newlines) with single space
    cleaned = cleaned.replace(/[ \t]+/g, ' ');

    // 4. Fix common alphanumeric confusion
    // a) 'o' or 'O' used as Bengali Zero '০' when surrounded by Bengali digits
    // e.g. '২০o5' -> '২০০৫', '১o' -> '১০'
    cleaned = cleaned.replace(/([০-৯])[oO]([০-৯])/g, '$1০$2');
    cleaned = cleaned.replace(/([০-৯])[oO]/g, '$1০');
    cleaned = cleaned.replace(/[oO]([০-৯])/g, '০$1');

    // b) Fix 'l' or '1' or 'I' or '|' being mistaken for Danda '।' when between Bengali chars
    cleaned = cleaned.replace(/([\u0980-\u09FF])\s+[lI|1]\s+([\u0980-\u09FF])/g, '$1 । $2');

    // 5. Fix common broken composites (Tesseract issues)
    // a) Broken A-kar: 'অ' + 'া' -> 'আ'
    cleaned = cleaned.replace(/অ\s*া/g, 'আ');

    // b) Broken Hasant composites: remove space around Hasant '্'
    // Fix space before Hasant: 'ক ্' -> 'ক্‌'
    cleaned = cleaned.replace(/\s+্/g, '্');
    // Fix space after Hasant: 'ক্‌ ষ' -> 'ক্ষ'
    cleaned = cleaned.replace(/্\s+/g, '্');

    // 6. Bengali Number Corrections (Context-aware)
    // a) '8' often misread as '৪' (Four)
    // Only if surrounded by other Bengali digits or at start/end of number block
    cleaned = cleaned.replace(/([০-৯])8/g, '$1৪');
    cleaned = cleaned.replace(/8([০-৯])/g, '৪$1');

    // b) 'q' or '9' misread as '৭' (Seven) - Conservative: only 'q' for now as '9' is valid English
    cleaned = cleaned.replace(/([০-৯])q/g, '$1৭');
    cleaned = cleaned.replace(/q([০-৯])/g, '৭$1');

    // 7. Garbage Cleanup
    // Remove isolated noise symbols often found in OCR
    // e.g. ^, \, _, ~ if they aren't part of a known pattern
    // We'll replace them with a space if they are standalone
    cleaned = cleaned.replace(/\s+[\\^_~]\s+/g, ' ');

    return cleaned.trim();
};

module.exports = {
    cleanText
};
