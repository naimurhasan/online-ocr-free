const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs').promises;

const TESSERACT_OPTS = {
    langPath: path.resolve('./tessdata'),
    gzip: false
};

// Persistent worker — reused across requests to avoid 2-4s init overhead
let cachedWorker = null;
let cachedLang = null;

const getWorker = async (lang) => {
    if (cachedWorker && cachedLang === lang) return cachedWorker;

    if (cachedWorker && cachedLang !== lang) {
        await cachedWorker.reinitialize(lang);
        cachedLang = lang;
        return cachedWorker;
    }

    cachedWorker = await Tesseract.createWorker(lang, undefined, TESSERACT_OPTS);
    await cachedWorker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        preserve_interword_spaces: '1'
    });
    cachedLang = lang;
    return cachedWorker;
};

const validateLanguages = async (lang = 'ben') => {
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

const recognize = async (imagePath, lang) => {
    const worker = await getWorker(lang);
    const result = await worker.recognize(imagePath);
    return result.data.text;
};

const terminateWorker = async () => {
    if (cachedWorker) {
        await cachedWorker.terminate();
        cachedWorker = null;
        cachedLang = null;
    }
};

module.exports = { validateLanguages, recognize, terminateWorker };
