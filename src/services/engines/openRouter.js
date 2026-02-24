const fs = require('fs').promises;

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS = {
    'gemma-openrouter-free': 'google/gemma-3-27b-it:free',
    'gemma-openrouter-paid': 'google/gemma-3-27b-it',
    'mistral-openrouter-free': 'mistralai/mistral-small-3.1-24b-instruct:free',
    'mistral-openrouter-paid': 'mistralai/mistral-small-3.1-24b-instruct'
};

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
    nep: 'Nepali'
};

const getLanguageLabelForPrompt = (lang = 'eng') => {
    return lang
        .split('+')
        .map(code => code.trim().toLowerCase())
        .filter(Boolean)
        .map(code => LANGUAGE_LABEL_MAP[code] || code)
        .join(', ');
};

const isOpenRouterEngine = (engine) => {
    return Object.keys(OPENROUTER_MODELS).includes(engine) || engine === 'openrouter-custom';
};

const extractText = async (imagePath, mimeType, lang, openRouterApiKey, outputFormat = 'plain', engineCode, customModel = '', customPrompt = '') => {
    customPrompt = (customPrompt || '').slice(0, MAX_CUSTOM_PROMPT_LENGTH);
    const resolvedKey = (openRouterApiKey || process.env.OPENROUTER_API_KEY || '').trim();
    if (!resolvedKey) {
        throw new Error('OpenRouter API key is required');
    }
    const rawKey = resolvedKey.toLowerCase().startsWith('bearer ')
        ? resolvedKey.slice(7).trim()
        : resolvedKey;
    if (!rawKey) {
        throw new Error('OpenRouter API key is required');
    }

    const safeMimeType = mimeType || 'image/png';
    const imageBuffer = await fs.readFile(imagePath);
    const imageDataUrl = `data:${safeMimeType};base64,${imageBuffer.toString('base64')}`;
    const languageHint = getLanguageLabelForPrompt(lang);
    const format = outputFormat === 'markdown' ? 'markdown' : 'plain';
    const formatInstruction = format === 'markdown'
        ? 'Return valid Markdown only. Preserve structure using headings, lists, tables, and code blocks when present. Do not add commentary.'
        : 'Return plain text only. Preserve line breaks and reading order. Do not add commentary.';

    const response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${rawKey}`,
            'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:3000',
            'X-Title': process.env.OPENROUTER_APP_TITLE || 'OCR Magic'
        },
        body: JSON.stringify({
            model: engineCode === 'openrouter-custom' && customModel ? customModel : (OPENROUTER_MODELS[engineCode] || OPENROUTER_MODELS['gemma-openrouter-free']),
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: customPrompt
                                ? customPrompt
                                    .replace('{{FORMAT_INSTRUCTION}}', formatInstruction)
                                    .replace('{{LANGUAGE_HINT}}', languageHint || 'auto')
                                : `You are an OCR engine. Extract all readable text from this image.\nRules:\n- ${formatInstruction}\n- Do not translate text.\nLanguage hint: ${languageHint || 'auto'}.`
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: imageDataUrl
                            }
                        }
                    ]
                }
            ]
        })
    });

    const payload = await response.json();
    if (!response.ok) {
        console.error("OpenRouter Error Payload:", JSON.stringify(payload, null, 2));
        const message = payload?.error?.message || `OpenRouter request failed (${response.status})`;
        throw new Error(message);
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (Array.isArray(content)) {
        return content
            .map(part => (typeof part === 'string' ? part : part?.text || ''))
            .join('\n')
            .trim();
    }

    return (content || '').trim();
};

module.exports = { extractText, isOpenRouterEngine, OPENROUTER_MODELS };
