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
    const useGoogleVision = engine === 'google-vision';
    let textResult = '';

    if (!useGoogleVision) {
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
