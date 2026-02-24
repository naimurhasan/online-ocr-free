const { convertPdfToImages, deleteFile } = require('../utils/fileUtils');
const { cleanText } = require('../utils/textUtils');
const tesseractEngine = require('./engines/tesseract');
const googleVisionEngine = require('./engines/googleVision');
const openRouterEngine = require('./engines/openRouter');
const geminiEngine = require('./engines/geminiFlash');
const { preprocessImageWithSteps, advancedPreprocessWithSteps, clearTempFolder } = require('./preprocessing');

const extractText = async (filePath, mimetype, lang = 'ben', saveSteps = true, options = {}) => {
    const engine = options.engine || 'tesseract';
    const googleApiKey = options.googleApiKey || '';
    const openRouterApiKey = options.openRouterApiKey || '';
    const openRouterOutputFormat = options.openRouterOutputFormat || 'plain';
    const openRouterCustomModel = options.openRouterCustomModel || '';
    const geminiApiKey = options.geminiApiKey || '';
    const geminiCustomModel = options.geminiCustomModel || '';
    const customPrompt = options.customPrompt || '';
    const skipPreprocessing = !!options.skipPreprocessing;
    const useTesseract = engine === 'tesseract';
    const useGoogleVision = engine === 'google-vision';
    const useGemini = engine === 'gemini-flash' || engine === 'gemini-custom';
    const useOpenRouter = openRouterEngine.isOpenRouterEngine(engine);
    let textResult = '';

    if (useTesseract) {
        await tesseractEngine.validateLanguages(lang);
    }

    if (mimetype === 'application/pdf') {
        const imageFiles = await convertPdfToImages(filePath);

        for (let i = 0; i < imageFiles.length; i++) {
            const image = imageFiles[i];
            console.log(`\n📄 Processing page ${i + 1}/${imageFiles.length}...`);

            let text = '';
            if (useGoogleVision) {
                console.log('🔍 Running OCR with Google Vision API...');
                text = await googleVisionEngine.extractText(image, lang, googleApiKey);
            } else if (useGemini) {
                console.log('🔍 Running OCR with Gemini Flash...');
                text = await geminiEngine.extractText(image, 'image/png', lang, geminiApiKey, customPrompt, geminiCustomModel);
            } else if (useOpenRouter) {
                console.log(`🔍 Running OCR with OpenRouter (${engine === 'openrouter-custom' ? openRouterCustomModel : engine})...`);
                text = await openRouterEngine.extractText(image, 'image/png', lang, openRouterApiKey, openRouterOutputFormat, engine, openRouterCustomModel, customPrompt);
            } else {
                const processedImage = skipPreprocessing
                    ? image
                    : await preprocessImageWithSteps(image, `page${i + 1}`);

                console.log('🔍 Running OCR with Tesseract...');
                text = await tesseractEngine.recognize(processedImage, lang);
            }

            textResult += text + '\n\n';
            console.log('✅ OCR completed for page', i + 1);

            deleteFile(image);
        }
    } else {
        console.log('\n📄 Processing single image...');

        if (useGoogleVision) {
            console.log('🔍 Running OCR with Google Vision API...');
            textResult = await googleVisionEngine.extractText(filePath, lang, googleApiKey);
        } else if (useGemini) {
            console.log('🔍 Running OCR with Gemini Flash...');
            textResult = await geminiEngine.extractText(filePath, mimetype, lang, geminiApiKey, customPrompt, geminiCustomModel);
        } else if (useOpenRouter) {
            console.log(`🔍 Running OCR with OpenRouter (${engine === 'openrouter-custom' ? openRouterCustomModel : engine})...`);
            textResult = await openRouterEngine.extractText(filePath, mimetype, lang, openRouterApiKey, openRouterOutputFormat, engine, openRouterCustomModel, customPrompt);
        } else {
            const processedImage = skipPreprocessing
                ? filePath
                : await preprocessImageWithSteps(filePath, 'single');

            console.log('🔍 Running OCR with Tesseract...');
            textResult = await tesseractEngine.recognize(processedImage, lang);
        }
        console.log('✅ OCR completed');
    }

    console.log('\n✨ Text extraction complete!');

    console.log('🧹 Running Rule-Based Cleaner...');
    const cleanedText = cleanText(textResult);

    return cleanedText;
};

module.exports = {
    extractText,
    preprocessImageWithSteps,
    advancedPreprocessWithSteps,
    clearTempFolder
};
