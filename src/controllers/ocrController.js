const path = require('path');
const { extractText } = require('../services/ocrService');
const { deleteFile } = require('../utils/fileUtils');

exports.processFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { path: filePath, mimetype } = req.file;
        const lang = req.body.lang || 'eng+ben';
        const engine = req.body.engine || 'tesseract';
        const googleApiKey = (req.body.googleApiKey || '').trim();
        const geminiApiKey = (req.body.geminiApiKey || '').trim();
        const openRouterApiKey = (req.body.openRouterApiKey || process.env.OPENROUTER_API_KEY || '').trim();
        const openRouterOutputFormat = (req.body.openRouterOutputFormat || 'plain').trim().toLowerCase();
        const openRouterCustomModel = (req.body.openRouterCustomModel || '').trim();
        const customPrompt = (req.body.customPrompt || '').trim();
        const skipPreprocessing = req.body.skipPreprocessing === 'true' || req.body.skipPreprocessing === true;

        if (engine === 'gemma-openrouter' && !openRouterApiKey) {
            if (req.file) deleteFile(req.file.path);
            return res.status(400).json({ error: 'OpenRouter API key is required. Provide it in UI or set OPENROUTER_API_KEY in .env.' });
        }

        if (engine === 'gemini-flash' && !geminiApiKey) {
            if (req.file) deleteFile(req.file.path);
            return res.status(400).json({ error: 'Gemini API key is required.' });
        }

        const reqId = Date.now() % 100000;
        console.log(`⏱️ [REQ-${reqId}] START: ${req.file.originalname} (engine: ${engine}) at ${new Date().toLocaleTimeString()}`);

        const textResult = await extractText(filePath, mimetype, lang, true, {
            engine,
            googleApiKey,
            geminiApiKey,
            openRouterApiKey,
            openRouterOutputFormat,
            openRouterCustomModel,
            customPrompt,
            skipPreprocessing
        });

        console.log(`✅ [REQ-${reqId}] DONE: ${req.file.originalname} at ${new Date().toLocaleTimeString()}`);
        deleteFile(filePath);
        res.json({ text: textResult });

    } catch (error) {
        console.error('Processing Error:', error);
        if (req.file) deleteFile(req.file.path);
        const safeMessages = ['Google Vision API key is required', 'OpenRouter API key is required', 'Gemini API key is required', 'Gemini request failed', 'Missing Tesseract language data'];
        const isSafe = safeMessages.some(msg => error.message?.startsWith(msg));
        res.status(500).json({ error: isSafe ? error.message : 'Failed to process file' });
    }
};

exports.processBatch = async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const { email, lang } = req.body;
    const engine = req.body.engine || 'tesseract';
    const googleApiKey = (req.body.googleApiKey || '').trim();
    const geminiApiKey = (req.body.geminiApiKey || '').trim();
    const openRouterApiKey = (req.body.openRouterApiKey || process.env.OPENROUTER_API_KEY || '').trim();
    const openRouterOutputFormat = (req.body.openRouterOutputFormat || 'plain').trim().toLowerCase();
    const openRouterCustomModel = (req.body.openRouterCustomModel || '').trim();
    const customPrompt = (req.body.customPrompt || '').trim();
    const skipPreprocessing = req.body.skipPreprocessing === 'true' || req.body.skipPreprocessing === true;
    const files = req.files;

    res.json({ message: 'Batch processing started. Results will be emailed.', fileCount: files.length });

    processBatchFiles(files, lang || 'eng+ben', email, {
        engine,
        googleApiKey,
        geminiApiKey,
        openRouterApiKey,
        openRouterOutputFormat,
        openRouterCustomModel,
        customPrompt,
        skipPreprocessing
    });
};

const archiver = require('archiver');

exports.downloadZip = async (req, res) => {
    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'No content to zip' });
    }

    res.attachment('ocr_results.zip');

    const archive = archiver('zip', {
        zlib: { level: 9 }
    });

    archive.on('warning', function (err) {
        if (err.code === 'ENOENT') {
            console.warn(err);
        } else {
            throw err;
        }
    });

    archive.on('error', function (err) {
        res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    for (const file of files) {
        if (file.filename && file.text) {
            const safeName = path.basename(file.filename);
            archive.append(file.text, { name: safeName });
        }
    }

    archive.finalize();
};

exports.formatForPdf = async (req, res) => {
    try {
        const { text, engine, openRouterApiKey, openRouterCustomModel, lang } = req.body;

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({ error: 'No text provided for formatting' });
        }

        const resolvedEngine = engine || 'gemma-openrouter-free';
        const resolvedKey = (openRouterApiKey || process.env.OPENROUTER_API_KEY || '').trim();

        if (!resolvedKey) {
            return res.status(400).json({ error: 'OpenRouter API key is required for AI formatting' });
        }

        const { isOpenRouterEngine } = require('../services/engines/openRouter');
        if (!isOpenRouterEngine(resolvedEngine)) {
            return res.status(400).json({ error: 'Invalid engine for AI formatting' });
        }

        const { formatTextAsHtml } = require('../services/pdfFormatService');
        const html = await formatTextAsHtml(text, resolvedKey, resolvedEngine, openRouterCustomModel || '', lang || 'eng');

        res.json({ html });
    } catch (error) {
        console.error('Format for PDF Error:', error);
        const safeMessages = ['OpenRouter API key is required', 'OpenRouter request failed'];
        const isSafe = safeMessages.some(msg => error.message?.startsWith(msg));
        res.status(500).json({ error: isSafe ? error.message : 'Failed to format text for PDF' });
    }
};

async function processBatchFiles(files, langKey, email, options = {}) {
    let results = [];
    const lang = langKey || 'eng+ben';

    for (const file of files) {
        try {
            const fileText = await extractText(file.path, file.mimetype, lang, true, options);
            results.push({ filename: file.originalname, text: fileText });
        } catch (err) {
            console.error(`Error processing ${file.originalname}:`, err);
            results.push({ filename: file.originalname, error: 'Processing failed' });
        } finally {
            deleteFile(file.path);
        }
    }
}
