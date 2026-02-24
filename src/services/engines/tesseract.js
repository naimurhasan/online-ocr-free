const Tesseract = require('tesseract.js');
const path = require('path');
const fs = require('fs').promises;

const TESSERACT_OPTS = {
    langPath: path.resolve('./tessdata'),
    gzip: false
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
    const result = await Tesseract.recognize(
        imagePath,
        lang,
        {
            ...TESSERACT_OPTS,
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            preserve_interword_spaces: '1'
        }
    );
    return result.data.text;
};

module.exports = { validateLanguages, recognize };
