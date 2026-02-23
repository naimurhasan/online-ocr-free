const { sendEmail } = require('../utils/emailService');
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
        const openRouterApiKey = (req.body.openRouterApiKey || process.env.OPENROUTER_API_KEY || '').trim();
        const openRouterOutputFormat = (req.body.openRouterOutputFormat || 'plain').trim().toLowerCase();

        if (engine === 'gemma-openrouter' && !openRouterApiKey) {
            if (req.file) deleteFile(req.file.path);
            return res.status(400).json({ error: 'OpenRouter API key is required. Provide it in UI or set OPENROUTER_API_KEY in .env.' });
        }

        console.log(`Processing file: ${filePath} with lang: ${lang} and engine: ${engine}`);

        const textResult = await extractText(filePath, mimetype, lang, true, {
            engine,
            googleApiKey,
            openRouterApiKey,
            openRouterOutputFormat
        });

        deleteFile(filePath);
        res.json({ text: textResult });

    } catch (error) {
        console.error('Processing Error:', error);
        if (req.file) deleteFile(req.file.path);
        res.status(500).json({ error: error.message || 'Failed to process file' });
    }
};

exports.processBatch = async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const { email, lang } = req.body;
    const engine = req.body.engine || 'tesseract';
    const googleApiKey = (req.body.googleApiKey || '').trim();
    const openRouterApiKey = (req.body.openRouterApiKey || process.env.OPENROUTER_API_KEY || '').trim();
    const openRouterOutputFormat = (req.body.openRouterOutputFormat || 'plain').trim().toLowerCase();
    const files = req.files;

    // Immediate response
    res.json({ message: 'Batch processing started. Results will be emailed.', fileCount: files.length });

    // Background processing
    processBatchFiles(files, lang || 'eng+ben', email, {
        engine,
        googleApiKey,
        openRouterApiKey,
        openRouterOutputFormat
    });
};

const archiver = require('archiver');

exports.downloadZip = async (req, res) => {
    const { files } = req.body; // Expects [{ filename: 'doc.txt', text: 'content' }, ...]

    if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).json({ error: 'No content to zip' });
    }

    res.attachment('ocr_results.zip');

    const archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
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
            archive.append(file.text, { name: file.filename });
        }
    }

    archive.finalize();
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
    // ... email logic ... (omitted for brevity, assume it's same)
    if (email && results.length > 0) {
        await sendEmail(email, results);
    }
}
