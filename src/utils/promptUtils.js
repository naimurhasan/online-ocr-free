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
        return `Return valid Markdown that preserves the document's visual structure.
Rules for structure preservation:
- Use # for main titles, ## for section headings, ### for subsections — match the visual hierarchy.
- Use standard paragraphs with blank lines between them.
- Reproduce tables using Markdown table syntax (| col1 | col2 |) with alignment.
- Use - or * for bulleted lists, 1. 2. 3. for numbered lists.
- For multi-column layouts: transcribe left column first, then right column, separated by a horizontal rule (---).
- For addresses, signatures, dates, or header/footer blocks: preserve line breaks using two trailing spaces.
- Bold (**text**) for visually bold text; italic (*text*) for italicized text.
- For mathematical expressions: use LaTeX notation with $...$ for inline math and $$...$$ for display/block math.
- If the document has a letterhead or form fields, preserve the structure using bold labels and indented values.
- Do not add commentary, summaries, or extra content. Do not wrap output in code fences.`;
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
    return `You are an OCR engine. Extract all readable text from this image.\nRules:\n- ${formatInstruction}\n- Do not translate text.\nLanguage hint: ${languageHint || 'auto'}.`;
};

module.exports = {
    LANGUAGE_LABEL_MAP,
    MAX_CUSTOM_PROMPT_LENGTH,
    getLanguageLabel,
    getFormatInstruction,
    buildOcrPrompt
};
