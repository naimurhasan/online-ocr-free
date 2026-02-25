const fs = require('fs').promises;
const { getLanguageLabel, getFormatInstruction, buildOcrPrompt } = require('../../utils/promptUtils');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash-preview-05-20';
const REQUEST_TIMEOUT_MS = 120_000;

const extractText = async (imagePath, mimeType, lang, geminiApiKey, outputFormat = 'plain', customPrompt = '', geminiCustomModel = '') => {
    if (!geminiApiKey) {
        throw new Error('Gemini API key is required');
    }

    const modelId = (geminiCustomModel || '').trim() || GEMINI_DEFAULT_MODEL;
    const endpoint = `${GEMINI_BASE_URL}/${modelId}:generateContent`;

    const safeMimeType = mimeType || 'image/png';
    const imageBuffer = await fs.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const languageHint = getLanguageLabel(lang);
    const format = outputFormat === 'markdown' ? 'markdown' : 'plain';
    const formatInstruction = getFormatInstruction(format);
    const prompt = buildOcrPrompt(formatInstruction, languageHint, customPrompt);

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

    let response;
    try {
        response = await fetch(`${endpoint}?key=${encodeURIComponent(geminiApiKey)}`, {
            method: 'POST',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
    } catch (err) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            throw new Error('Request timed out — the model took too long to respond. Please try again or switch to a different model.');
        }
        throw err;
    }

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
