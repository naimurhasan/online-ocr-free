const MAX_CUSTOM_PROMPT_LENGTH = 2000;

const LANGUAGE_LABEL_MAP = {
    ben: 'Bangla',
    eng: 'English',
    hin: 'Hindi',
    ara: 'Arabic',
    urd: 'Urdu',
    tam: 'Tamil',
    tel: 'Telugu',
    mar: 'Marathi',
    nep: 'Nepali',
    chi_sim: 'Chinese Simplified',
    chi_tra: 'Chinese Traditional',
    jpn: 'Japanese',
    kor: 'Korean',
    fra: 'French',
    deu: 'German',
    spa: 'Spanish'
};

const getLanguageLabel = (lang = 'eng') => {
    return lang
        .split('+')
        .map(code => code.trim().toLowerCase())
        .filter(Boolean)
        .map(code => LANGUAGE_LABEL_MAP[code] || code)
        .join(', ');
};

const getFormatInstruction = (format) => {
    if (format === 'markdown') {
        return `Return valid Markdown and HTML that strictly preserves the visual and structural layout of the document.

### Rules for Structure Preservation:
- **Layout Detection (CRITICAL):**
    - If the image has a **multi-column layout**, you MUST use an HTML \`<table>\` with \`style="border: none; border-collapse: collapse; width: 100%;"\` to represent text side-by-side.
    - Ensure all \`<td>\` and \`<tr>\` tags include \`style="border: none; vertical-align: top;"\` to ensure no borders are rendered and text aligns to the top.
    - If the image is a **single-column layout**, use standard paragraphs and headings.
- **Hierarchy:** Use appropriate Markdown headers (#, ##, ###) or bold text to match visual importance.
- **Mathematical Expressions:** You **must** use $...$ for inline math and $$...$$ for block math. Do not use \\( or \\[.
- **Formatting:** Use **bold** for visually bold text and *italics* for italicized text.
- **Lists:** Use Markdown syntax for bullets or numbered lists.
- **Accuracy:** Transcribe text exactly as written, including punctuation and capitalization.

### Output Constraints:
- Do not add commentary or summaries.
- Do not translate the text.
- Return only the Markdown/HTML content.
- Since standard Markdown tables (|---|) always show borders, **use HTML tables for multi-column layouts to ensure a borderless appearance.**`;
    }
    return 'Return plain text only. Preserve line breaks and reading order. Do not add commentary.';
};

const buildOcrPrompt = (formatInstruction, languageHint, customPrompt) => {
    if (customPrompt) {
        return customPrompt
            .slice(0, MAX_CUSTOM_PROMPT_LENGTH)
            .replace('{{FORMAT_INSTRUCTION}}', formatInstruction)
            .replace('{{LANGUAGE_HINT}}', languageHint || 'auto');
    }
    return `You are an advanced OCR engine. Extract all readable text from this image.\n${formatInstruction}\nLanguage hint: ${languageHint || 'auto'}.`;
};

module.exports = {
    LANGUAGE_LABEL_MAP,
    MAX_CUSTOM_PROMPT_LENGTH,
    getLanguageLabel,
    getFormatInstruction,
    buildOcrPrompt
};
