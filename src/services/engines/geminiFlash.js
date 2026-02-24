const fs = require('fs').promises;

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash-preview-05-20';

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

const getLanguageLabel = (lang = 'eng') => {
    return lang
        .split('+')
        .map(code => code.trim().toLowerCase())
        .filter(Boolean)
        .map(code => LANGUAGE_LABEL_MAP[code] || code)
        .join(', ');
};

const extractText = async (imagePath, mimeType, lang, geminiApiKey, customPrompt = '', geminiCustomModel = '') => {
    if (!geminiApiKey) {
        throw new Error('Gemini API key is required');
    }

    const modelId = (geminiCustomModel || '').trim() || GEMINI_DEFAULT_MODEL;
    const endpoint = `${GEMINI_BASE_URL}/${modelId}:generateContent`;

    customPrompt = (customPrompt || '').slice(0, MAX_CUSTOM_PROMPT_LENGTH);
    const safeMimeType = mimeType || 'image/png';
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const languageHint = getLanguageLabel(lang);

    const prompt = customPrompt
        ? customPrompt.replace('{{LANGUAGE_HINT}}', languageHint || 'auto')
        : `You are an OCR engine. Extract all readable text from this image.\nRules:\n- Return plain text only. Preserve line breaks and reading order. Do not add commentary.\n- Do not translate text.\nLanguage hint: ${languageHint || 'auto'}.`;

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        inline_data: {
                            mime_type: safeMimeType,
                            data: base64Image
                        }
                    },
                    {
                        text: prompt
                    }
                ]
            }
        ]
    };

    const response = await fetch(`${endpoint}?key=${encodeURIComponent(geminiApiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    const payload = await response.json();
    if (!response.ok) {
        console.error('Gemini Error Payload:', JSON.stringify(payload, null, 2));
        const message = payload?.error?.message || `Gemini request failed (${response.status})`;
        throw new Error(message);
    }

    const content = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    return (content || '').trim();
};

module.exports = { extractText };
