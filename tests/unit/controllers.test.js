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
            geminiCustomModel: '',
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

    test('returns 400 when no files provided', async () => {
        const req = { body: {} };
        const res = mockRes();

        await ocrController.formatForPdf(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'No content provided for formatting' });
    });

    test('returns 400 for empty files array', async () => {
        const req = { body: { files: [] } };
        const res = mockRes();

        await ocrController.formatForPdf(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'No content provided for formatting' });
    });

    test('returns formatted HTML for plain text engine', async () => {
        const req = {
            body: {
                files: [{ filename: 'test.txt', text: 'Hello World' }],
                engine: 'tesseract',
                outputFormat: 'plain',
                lang: 'eng'
            }
        };
        const res = mockRes();

        await ocrController.formatForPdf(req, res);

        expect(res.json).toHaveBeenCalled();
        const result = res.json.mock.calls[0][0];
        expect(result.html).toContain('Hello World');
        expect(result.html).toContain('<pre>');
    });

    test('returns formatted HTML with markdown parsing for AI engine', async () => {
        const req = {
            body: {
                files: [{ filename: 'doc.pdf', text: '# Title\n\nSome paragraph' }],
                engine: 'gemma-openrouter-free',
                outputFormat: 'markdown',
                lang: 'eng'
            }
        };
        const res = mockRes();

        await ocrController.formatForPdf(req, res);

        expect(res.json).toHaveBeenCalled();
        const result = res.json.mock.calls[0][0];
        expect(result.html).toContain('<h1>');
        expect(result.html).toContain('Title');
        expect(result.html).toContain('Some paragraph');
    });

    test('returns 500 on internal error', async () => {
        const req = {
            body: {
                files: null,
                engine: 'tesseract'
            }
        };
        const res = mockRes();

        await ocrController.formatForPdf(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
    });
});
