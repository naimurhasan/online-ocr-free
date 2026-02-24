const { OPENROUTER_MODELS } = require('./engines/openRouter');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_TEXT_LENGTH = 100000;

const LANGUAGE_LABEL_MAP = {
    ben: 'Bangla', eng: 'English', hin: 'Hindi', ara: 'Arabic',
    urd: 'Urdu', chi_sim: 'Chinese Simplified', chi_tra: 'Chinese Traditional',
    jpn: 'Japanese', kor: 'Korean', fra: 'French', deu: 'German', spa: 'Spanish'
};

const getLanguageLabel = (lang = 'eng') => {
    return lang.split('+').map(c => c.trim().toLowerCase())
        .filter(Boolean).map(c => LANGUAGE_LABEL_MAP[c] || c).join(', ');
};

const formatTextAsHtml = async (text, apiKey, engineCode, customModel, lang) => {
    const truncatedText = text.slice(0, MAX_TEXT_LENGTH);
    const languageHint = getLanguageLabel(lang);

    const rawKey = apiKey.toLowerCase().startsWith('bearer ')
        ? apiKey.slice(7).trim()
        : apiKey;
    if (!rawKey) {
        throw new Error('OpenRouter API key is required');
    }

    const model = engineCode === 'openrouter-custom' && customModel
        ? customModel
        : (OPENROUTER_MODELS[engineCode] || OPENROUTER_MODELS['gemma-openrouter-free']);

    const systemPrompt = `You are a document formatter. You receive OCR-extracted text and must return it as well-structured, clean HTML for PDF generation.

Rules:
- Return ONLY valid HTML content (no <html>, <head>, or <body> tags -- just the inner content).
- Use semantic HTML: <h1>, <h2>, <h3> for headings; <p> for paragraphs; <ul>/<ol>/<li> for lists; <table>/<tr>/<td> for tabular data; <strong> for emphasis.
- Preserve the original text content exactly. Do NOT translate, summarize, or add new content.
- Fix obvious OCR formatting issues (broken paragraphs, misplaced line breaks) to improve readability.
- Use inline styles sparingly for layout (e.g., margin, padding).
- The document language is: ${languageHint || 'auto-detect'}.
- If there are section breaks (marked with ===== filename =====), convert them to <h1> headings followed by <hr>.
- Keep the HTML simple and renderable.`;

    const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${rawKey}`,
            'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:3000',
            'X-Title': process.env.OPENROUTER_APP_TITLE || 'OCR Magic'
        },
        body: JSON.stringify({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Format the following OCR text as HTML:\n\n${truncatedText}` }
            ]
        })
    });

    const payload = await response.json();
    if (!response.ok) {
        console.error('OpenRouter Format Error:', JSON.stringify(payload, null, 2));
        const message = payload?.error?.message || `OpenRouter request failed (${response.status})`;
        throw new Error(message);
    }

    let content = payload?.choices?.[0]?.message?.content || '';
    if (Array.isArray(content)) {
        content = content.map(part => (typeof part === 'string' ? part : part?.text || '')).join('\n');
    }

    content = content.replace(/^```html\s*/i, '').replace(/\s*```\s*$/i, '').trim();

    return content;
};

module.exports = { formatTextAsHtml };
