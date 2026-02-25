const fs = require('fs').promises;

const GOOGLE_VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';
const REQUEST_TIMEOUT_MS = 120_000;

const LANGUAGE_HINTS_MAP = {
    ben: 'bn',
    eng: 'en',
    hin: 'hi',
    ara: 'ar',
    urd: 'ur',
    tam: 'ta',
    tel: 'te',
    mar: 'mr',
    nep: 'ne'
};

const getLanguageHints = (lang = 'ben') => {
    return lang
        .split('+')
        .map(code => code.trim().toLowerCase())
        .map(code => LANGUAGE_HINTS_MAP[code] || null)
        .filter(Boolean);
};

const extractText = async (imagePath, lang, googleApiKey) => {
    if (!googleApiKey) {
        throw new Error('Google Vision API key is required');
    }

    const imageBuffer = await fs.readFile(imagePath);
    const languageHints = getLanguageHints(lang);
    const requestBody = {
        requests: [
            {
                image: {
                    content: imageBuffer.toString('base64')
                },
                features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
                imageContext: languageHints.length > 0 ? { languageHints } : undefined
            }
        ]
    };

    let response;
    try {
        response = await fetch(`${GOOGLE_VISION_ENDPOINT}?key=${encodeURIComponent(googleApiKey)}`, {
            method: 'POST',
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
            headers: {
                'Content-Type': 'application/json'
            },
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
        const message = payload?.error?.message || `Google Vision request failed (${response.status})`;
        throw new Error(message);
    }

    const apiResponse = payload?.responses?.[0];
    if (apiResponse?.error?.message) {
        throw new Error(apiResponse.error.message);
    }

    return apiResponse?.fullTextAnnotation?.text || apiResponse?.textAnnotations?.[0]?.description || '';
};

module.exports = { extractText };
