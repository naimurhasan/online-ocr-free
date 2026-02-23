const Tesseract = require('tesseract.js');
const path = require('path');
const sharp = require('sharp');

const fs = require('fs').promises;
const { convertPdfToImages, deleteFile } = require('../utils/fileUtils');
const { cleanText } = require('../utils/textUtils');

const TESSERACT_OPTS = {
    langPath: path.resolve('./tessdata'),
    gzip: false
};

const GOOGLE_VISION_ENDPOINT = 'https://vision.googleapis.com/v1/images:annotate';
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS = {
    'gemma-openrouter-free': 'google/gemma-3-27b-it:free',
    'gemma-openrouter-paid': 'google/gemma-3-27b-it',
    'mistral-openrouter-free': 'mistralai/mistral-small-3.1-24b-instruct:free',
    'mistral-openrouter-paid': 'mistralai/mistral-small-3.1-24b-instruct'
};

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

const getGoogleLanguageHints = (lang = 'ben') => {
    return lang
        .split('+')
        .map(code => code.trim().toLowerCase())
        .map(code => LANGUAGE_HINTS_MAP[code] || null)
        .filter(Boolean);
};

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

const extractTextWithGoogleVision = async (imagePath, lang, googleApiKey) => {
    if (!googleApiKey) {
        throw new Error('Google Vision API key is required');
    }

    const imageBuffer = await fs.readFile(imagePath);
    const languageHints = getGoogleLanguageHints(lang);
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

    const response = await fetch(`${GOOGLE_VISION_ENDPOINT}?key=${encodeURIComponent(googleApiKey)}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

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

const extractTextWithOpenRouter = async (imagePath, mimeType, lang, openRouterApiKey, outputFormat = 'plain', engineCode, customModel = '') => {
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
                            text: `You are an OCR engine. Extract all readable text from this image.\nRules:\n- ${formatInstruction}\n- Do not translate text.\nLanguage hint: ${languageHint || 'auto'}.`
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

const validateTesseractLanguages = async (lang = 'ben') => {
    const requested = [...new Set(
        lang
            .split('+')
            .map(code => code.trim().toLowerCase())
            .filter(Boolean)
    )];

    const missing = [];
    for (const code of requested) {
        const traineddataPath = path.resolve('./tessdata', `${code}.traineddata`);
        try {
            await fs.access(traineddataPath);
        } catch {
            missing.push(`${code}.traineddata`);
        }
    }

    if (missing.length > 0) {
        throw new Error(`Missing Tesseract language data: ${missing.join(', ')}. Add them in ./tessdata or switch OCR engine to Google Vision API.`);
    }
};

const ensureTempFolder = async () => {
    const tempDir = path.resolve('./temp');
    try {
        await fs.access(tempDir);
    } catch {
        await fs.mkdir(tempDir, { recursive: true });
    }
    return tempDir;
};

const preprocessImageWithSteps = async (imagePath, stepPrefix = 'image') => {
    const tempDir = await ensureTempFolder();
    const timestamp = Date.now();

    // Step 0: Original (Keep for reference)
    const step0Path = path.join(tempDir, `${stepPrefix}_${timestamp}_0_original.png`);
    await sharp(imagePath).toFile(step0Path);
    console.log('✅ Step 0: Original saved to', step0Path);

    // Optimized Step: Combined Processing
    // Grayscale -> Resize -> Normalize -> Sharpen -> Median (Denoise) -> Threshold
    const finalPath = path.join(tempDir, `${stepPrefix}_${timestamp}_final_processed.png`);

    await sharp(step0Path)
        .grayscale()
        .resize({
            width: 3000,
            fit: 'inside',
            withoutEnlargement: false
        })
        .normalize()
        // Matra Fix: Thicken text
        // 1. Sharpen to enhance edges
        .sharpen()
        // 2. Blur to spread black pixels (dilation simulation)
        .blur(0.5)
        // 3. High Threshold to capture the spread (gray) pixels as black
        .threshold(160)
        .toFile(finalPath);

    console.log('✅ Optimized Processing Complete:', finalPath);
    console.log('\n📁 Processed image saved in:', tempDir);

    return finalPath;
};

const advancedPreprocessWithSteps = async (imagePath, stepPrefix = 'advanced') => {
    const tempDir = await ensureTempFolder();
    const timestamp = Date.now();

    // Step 0: Original
    const step0Path = path.join(tempDir, `${stepPrefix}_${timestamp}_0_original.png`);
    await sharp(imagePath).toFile(step0Path);

    console.log('🔍 Running Optimized Advanced Preprocessing...');

    // Combined Chain: Grayscale -> Median -> Linear (Contrast) -> Resize -> Sharpen -> Threshold
    const finalPath = path.join(tempDir, `${stepPrefix}_${timestamp}_final_processed.png`);

    await sharp(step0Path)
        .grayscale()
        .median(3)
        .linear(1.5, -(128 * 1.5) + 128) // Contrast increase
        .resize({
            width: 3000,
            fit: 'inside',
            withoutEnlargement: false
        })
        .sharpen({ sigma: 1.5 })
        .threshold(140)
        .toFile(finalPath);

    console.log('✅ Advanced Processing Complete:', finalPath);
    return finalPath;
};



const extractText = async (filePath, mimetype, lang = 'ben', saveSteps = true, options = {}) => {
    const engine = options.engine || 'tesseract';
    const googleApiKey = options.googleApiKey || '';
    const openRouterApiKey = options.openRouterApiKey || '';
    const openRouterOutputFormat = options.openRouterOutputFormat || 'plain';
    const openRouterCustomModel = options.openRouterCustomModel || '';
    const useTesseract = engine === 'tesseract';
    const useGoogleVision = engine === 'google-vision';
    const useOpenRouter = Object.keys(OPENROUTER_MODELS).includes(engine) || engine === 'openrouter-custom';
    let textResult = '';

    if (useTesseract) {
        await validateTesseractLanguages(lang);
    }

    if (mimetype === 'application/pdf') {
        const imageFiles = await convertPdfToImages(filePath);

        for (let i = 0; i < imageFiles.length; i++) {
            const image = imageFiles[i];
            console.log(`\n📄 Processing page ${i + 1}/${imageFiles.length}...`);

            let text = '';
            if (useGoogleVision) {
                console.log('🔍 Running OCR with Google Vision API...');
                text = await extractTextWithGoogleVision(image, lang, googleApiKey);
            } else if (useOpenRouter) {
                console.log(`🔍 Running OCR with OpenRouter (${engine === 'openrouter-custom' ? openRouterCustomModel : engine})...`);
                text = await extractTextWithOpenRouter(image, 'image/png', lang, openRouterApiKey, openRouterOutputFormat, engine, openRouterCustomModel);
            } else {
                const processedImage = saveSteps
                    ? await preprocessImageWithSteps(image, `page${i + 1}`)
                    : await preprocessImageWithSteps(image, `page${i + 1}`);

                console.log('🔍 Running OCR with Tesseract...');
                const result = await Tesseract.recognize(
                    processedImage,
                    lang,
                    {
                        ...TESSERACT_OPTS,
                        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                        preserve_interword_spaces: '1'
                    }
                );
                text = result.data.text;
            }

            textResult += text + '\n\n';
            console.log('✅ OCR completed for page', i + 1);

            deleteFile(image);
        }
    } else {
        console.log('\n📄 Processing single image...');

        if (useGoogleVision) {
            console.log('🔍 Running OCR with Google Vision API...');
            textResult = await extractTextWithGoogleVision(filePath, lang, googleApiKey);
        } else if (useOpenRouter) {
            console.log(`🔍 Running OCR with OpenRouter (${engine === 'openrouter-custom' ? openRouterCustomModel : engine})...`);
            textResult = await extractTextWithOpenRouter(filePath, mimetype, lang, openRouterApiKey, openRouterOutputFormat, engine, openRouterCustomModel);
        } else {
            const processedImage = saveSteps
                ? await preprocessImageWithSteps(filePath, 'single')
                : await preprocessImageWithSteps(filePath, 'single');

            console.log('🔍 Running OCR with Tesseract...');
            const result = await Tesseract.recognize(
                processedImage,
                lang,
                {
                    ...TESSERACT_OPTS,
                    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                    preserve_interword_spaces: '1'
                }
            );

            textResult = result.data.text;
        }
        console.log('✅ OCR completed');
    }

    console.log('\n✨ Text extraction complete!');
    console.log('📁 Check ./temp folder for all preprocessing steps');

    // Apply rule-based cleaning
    console.log('🧹 Running Rule-Based Cleaner...');
    const cleanedText = cleanText(textResult);

    return cleanedText;
};

const clearTempFolder = async () => {
    const tempDir = path.resolve('./temp');
    try {
        const files = await fs.readdir(tempDir);
        for (const file of files) {
            await fs.unlink(path.join(tempDir, file));
        }
        console.log('🧹 Temp folder cleared');
    } catch (error) {
        console.log('ℹ️ No temp folder to clear');
    }
};

module.exports = {
    extractText,
    preprocessImageWithSteps,
    advancedPreprocessWithSteps,
    clearTempFolder
};
