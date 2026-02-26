const fs = require('fs').promises;
const { getLanguageLabel, getFormatInstruction, buildOcrPrompt } = require('../../utils/promptUtils');

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 120_000;
const OPENROUTER_MODELS = {
    'mistral-openrouter': 'mistralai/mistral-small-3.1-24b-instruct',
    'gemma-openrouter': 'google/gemma-3-27b-it',
    'gemini3-flash-openrouter': 'google/gemini-3-flash-preview',
    'nemotron-openrouter': 'nvidia/nemotron-nano-12b-v2-vl'
};

const isOpenRouterEngine = (engine) => {
    return Object.keys(OPENROUTER_MODELS).includes(engine) || engine === 'openrouter-custom';
};

const extractText = async (imagePath, mimeType, lang, openRouterApiKey, outputFormat = 'plain', engineCode, customModel = '', customPrompt = '') => {
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
    const languageHint = getLanguageLabel(lang);
    const format = outputFormat === 'markdown' ? 'markdown' : 'plain';
    const formatInstruction = getFormatInstruction(format);
    const prompt = buildOcrPrompt(formatInstruction, languageHint, customPrompt);

    let response;
    try {
        response = await fetch(OPENROUTER_ENDPOINT, {
            method: 'POST',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${rawKey}`,
                'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'http://localhost:3000',
                'X-Title': process.env.OPENROUTER_APP_TITLE || 'onlineocrfree'
            },
            body: JSON.stringify({
                model: engineCode === 'openrouter-custom' && customModel ? customModel : (OPENROUTER_MODELS[engineCode] || OPENROUTER_MODELS['gemma-openrouter-free']),
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
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
    } catch (err) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            throw new Error('Request timed out — the model took too long to respond. Please try again or switch to a different model.');
        }
        throw err;
    }

    const payload = await response.json();
    if (!response.ok) {
        console.error("OpenRouter Error Payload:", JSON.stringify(payload, null, 2));
        const rawMessage = payload?.error?.message || '';
        const statusCode = response.status;

        if (statusCode === 429 || statusCode === 503 || /overloaded|capacity|rate.limit|busy|unavailable/i.test(rawMessage)) {
            throw new Error('Out of capacity — the free model is currently overloaded. Please try again later or switch to a paid model.');
        }

        throw new Error(rawMessage || `OpenRouter request failed (${statusCode})`);
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
