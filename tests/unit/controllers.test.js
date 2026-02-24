const path = require('path');

jest.mock('../../src/services/ocrService', () => ({
    extractText: jest.fn()
}));
jest.mock('../../src/utils/fileUtils', () => ({
    deleteFile: jest.fn()
}));

const { extractText } = require('../../src/services/ocrService');
const { deleteFile } = require('../../src/utils/fileUtils');
const ocrController = require('../../src/controllers/ocrController');

const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.attachment = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    return res;
};

describe('ocrController.processFile', () => {
    afterEach(() => jest.clearAllMocks());

    test('returns 400 when no file uploaded', async () => {
        const req = { body: {} };
        const res = mockRes();

        await ocrController.processFile(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'No file uploaded' });
    });

    test('returns extracted text on success', async () => {
        extractText.mockResolvedValue('Hello World');
        const req = {
            file: { path: '/tmp/test.png', mimetype: 'image/png', originalname: 'test.png', filename: 'test.png' },
            body: { lang: 'eng', engine: 'tesseract' }
        };
        const res = mockRes();

        await ocrController.processFile(req, res);

        expect(extractText).toHaveBeenCalledWith('/tmp/test.png', 'image/png', 'eng', true, expect.objectContaining({
            engine: 'tesseract'
        }));
        expect(res.json).toHaveBeenCalledWith({ text: 'Hello World' });
        expect(deleteFile).toHaveBeenCalledWith('/tmp/test.png');
    });

    test('returns safe error messages for known errors', async () => {
        extractText.mockRejectedValue(new Error('Google Vision API key is required'));
        const req = {
            file: { path: '/tmp/test.png', mimetype: 'image/png', originalname: 'test.png' },
            body: {}
        };
        const res = mockRes();

        await ocrController.processFile(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Google Vision API key is required' });
    });

    test('returns generic error for unknown errors', async () => {
        extractText.mockRejectedValue(new Error('Internal database connection failed'));
        const req = {
            file: { path: '/tmp/test.png', mimetype: 'image/png', originalname: 'test.png' },
            body: {}
        };
        const res = mockRes();

        await ocrController.processFile(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to process file' });
    });

    test('cleans up file on error', async () => {
        extractText.mockRejectedValue(new Error('fail'));
        const req = {
            file: { path: '/tmp/test.png', mimetype: 'image/png', originalname: 'test.png' },
            body: {}
        };
        const res = mockRes();

        await ocrController.processFile(req, res);

        expect(deleteFile).toHaveBeenCalledWith('/tmp/test.png');
    });

    test('passes all options through to extractText', async () => {
        extractText.mockResolvedValue('text');
        const req = {
            file: { path: '/tmp/t.png', mimetype: 'image/png', originalname: 't.png', filename: 't.png' },
            body: {
                lang: 'ben',
                engine: 'gemma-openrouter-free',
                googleApiKey: 'gk',
                openRouterApiKey: 'ork',
                openRouterOutputFormat: 'markdown',
                openRouterCustomModel: 'custom/model',
                customPrompt: 'Extract text',
                skipPreprocessing: 'true'
            }
        };
        const res = mockRes();

        await ocrController.processFile(req, res);

        expect(extractText).toHaveBeenCalledWith('/tmp/t.png', 'image/png', 'ben', true, {
            engine: 'gemma-openrouter-free',
            googleApiKey: 'gk',
            geminiApiKey: '',
            openRouterApiKey: 'ork',
            openRouterOutputFormat: 'markdown',
            openRouterCustomModel: 'custom/model',
            customPrompt: 'Extract text',
            skipPreprocessing: true
        });
    });
});

describe('ocrController.processBatch', () => {
    afterEach(() => jest.clearAllMocks());

    test('returns 400 when no files uploaded', async () => {
        const req = { body: {} };
        const res = mockRes();

        await ocrController.processBatch(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'No files uploaded' });
    });

    test('returns 400 for empty files array', async () => {
        const req = { files: [], body: {} };
        const res = mockRes();

        await ocrController.processBatch(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('returns success with file count', async () => {
        extractText.mockResolvedValue('text');
        const req = {
            files: [
                { path: '/tmp/a.png', mimetype: 'image/png', originalname: 'a.png' },
                { path: '/tmp/b.png', mimetype: 'image/png', originalname: 'b.png' }
            ],
            body: { lang: 'eng', email: 'test@test.com' }
        };
        const res = mockRes();

        await ocrController.processBatch(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: expect.stringContaining('Batch processing started'),
            fileCount: 2
        }));
    });
});

describe('ocrController.downloadZip', () => {
    afterEach(() => jest.clearAllMocks());

    test('returns 400 when no files provided', async () => {
        const req = { body: {} };
        const res = mockRes();

        await ocrController.downloadZip(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'No content to zip' });
    });

    test('returns 400 for empty files array', async () => {
        const req = { body: { files: [] } };
        const res = mockRes();

        await ocrController.downloadZip(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('path.basename strips directory traversal from filenames', () => {
        expect(path.basename('../../../etc/passwd')).toBe('passwd');
        expect(path.basename('../../secret.txt')).toBe('secret.txt');
        expect(path.basename('/tmp/normal.txt')).toBe('normal.txt');
    });
});

describe('ocrController.formatForPdf', () => {
    afterEach(() => jest.clearAllMocks());

    test('returns 400 when no text provided', async () => {
        const req = { body: {} };
        const res = mockRes();

        await ocrController.formatForPdf(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'No text provided for formatting' });
    });

    test('returns 400 for empty string text', async () => {
        const req = { body: { text: '   ' } };
        const res = mockRes();

        await ocrController.formatForPdf(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'No text provided for formatting' });
    });

    test('returns 400 when no API key available', async () => {
        delete process.env.OPENROUTER_API_KEY;
        const req = { body: { text: 'Hello world', engine: 'gemma-openrouter-free' } };
        const res = mockRes();

        await ocrController.formatForPdf(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'OpenRouter API key is required for AI formatting' });
    });

    test('returns 400 for invalid engine', async () => {
        const req = { body: { text: 'Hello world', engine: 'tesseract', openRouterApiKey: 'key123' } };
        const res = mockRes();

        await ocrController.formatForPdf(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'Invalid engine for AI formatting' });
    });

    test('returns formatted HTML on success', async () => {
        jest.mock('../../src/services/pdfFormatService', () => ({
            formatTextAsHtml: jest.fn().mockResolvedValue('<h1>Hello</h1><p>World</p>')
        }));

        const req = {
            body: {
                text: 'Hello World',
                engine: 'gemma-openrouter-free',
                openRouterApiKey: 'sk-test-key',
                lang: 'eng'
            }
        };
        const res = mockRes();

        await ocrController.formatForPdf(req, res);

        expect(res.json).toHaveBeenCalledWith({ html: '<h1>Hello</h1><p>World</p>' });
    });

    test('returns safe error for OpenRouter failures', async () => {
        jest.mock('../../src/services/pdfFormatService', () => ({
            formatTextAsHtml: jest.fn().mockRejectedValue(new Error('OpenRouter request failed (401)'))
        }));

        jest.resetModules();
        const controller = require('../../src/controllers/ocrController');

        const req = {
            body: {
                text: 'Hello',
                engine: 'gemma-openrouter-free',
                openRouterApiKey: 'bad-key',
                lang: 'eng'
            }
        };
        const res = mockRes();

        await controller.formatForPdf(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'OpenRouter request failed (401)' });
    });

    test('returns generic error for unknown failures', async () => {
        jest.mock('../../src/services/pdfFormatService', () => ({
            formatTextAsHtml: jest.fn().mockRejectedValue(new Error('Database exploded'))
        }));

        jest.resetModules();
        const controller = require('../../src/controllers/ocrController');

        const req = {
            body: {
                text: 'Hello',
                engine: 'gemma-openrouter-free',
                openRouterApiKey: 'key',
                lang: 'eng'
            }
        };
        const res = mockRes();

        await controller.formatForPdf(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Failed to format text for PDF' });
    });
});
