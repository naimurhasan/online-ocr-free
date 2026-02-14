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

        console.log(`Processing file: ${filePath} with lang: ${lang}`);

        const textResult = await extractText(filePath, mimetype, lang);

        deleteFile(filePath);
        res.json({ text: textResult });

    } catch (error) {
        console.error('Processing Error:', error);
        if (req.file) deleteFile(req.file.path);
        res.status(500).json({ error: 'Failed to process file' });
    }
};

exports.processBatch = async (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
    }

    const { email, lang } = req.body;
    const files = req.files;

    // Immediate response
    res.json({ message: 'Batch processing started. Results will be emailed.', fileCount: files.length });

    // Background processing
    processBatchFiles(files, lang || 'eng+ben', email);
};

async function processBatchFiles(files, langKey, email) {
    let results = [];
    const lang = langKey || 'eng+ben';

    for (const file of files) {
        try {
            const fileText = await extractText(file.path, file.mimetype, lang);
            results.push({ filename: file.originalname, text: fileText });
        } catch (err) {
            console.error(`Error processing ${file.originalname}:`, err);
            results.push({ filename: file.originalname, error: 'Processing failed' });
        } finally {
            deleteFile(file.path);
        }
    }

    if (email && results.length > 0) {
        await sendEmail(email, results);
    }
}
