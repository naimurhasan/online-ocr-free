const path = require('path');
const fs = require('fs');

jest.mock('uuid', () => ({
    v4: jest.fn(() => 'test-uuid-1234')
}));

jest.mock('../../src/services/ocrService', () => ({
    extractText: jest.fn().mockResolvedValue('Extracted OCR text')
}));

jest.mock('../../src/utils/supabaseClient', () => ({
    db: {
        query: jest.fn().mockResolvedValue({ rows: [] })
    },
    storage: {
        from: jest.fn().mockReturnValue({
            upload: jest.fn().mockResolvedValue({ error: null })
        })
    }
}));

jest.mock('../../src/utils/emailService', () => ({
    sendOTP: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/services/jobWorker', () => ({
    start: jest.fn(),
    recoverStuckJobs: jest.fn().mockResolvedValue(),
    startCleanupSchedule: jest.fn()
}));

const request = require('supertest');

let app;

beforeAll(() => {
    process.env.PORT = '0';
    process.env.OCR_DEV_OTP = 'true';
    process.env.CORS_ORIGINS = '';

    const express = require('express');
    const multer = require('multer');

    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const storage = multer.diskStorage({
        destination: (req, file, cb) => cb(null, '/tmp'),
        filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
    });
    const upload = multer({ storage });

    const ocrController = require('../../src/controllers/ocrController');
    const emailController = require('../../src/controllers/emailController');

    app.get('/api/config', (req, res) => {
        res.json({ maxConcurrentThreads: 4, defaultPromptPlain: 'test plain prompt', defaultPromptMarkdown: 'test markdown prompt' });
    });

    app.post('/api/ocr', upload.single('file'), ocrController.processFile);
    app.post('/api/ocr/batch', upload.array('files'), ocrController.processBatch);
    app.post('/api/download-zip', ocrController.downloadZip);
    app.post('/api/format-for-pdf', ocrController.formatForPdf);
    app.post('/api/otp/send', emailController.sendOtp);
    app.post('/api/otp/verify', emailController.verifyOtp);
    app.post('/api/job/create', upload.array('files'), emailController.createJob);
    app.get('/api/job/active', emailController.getActiveJob);
    app.get('/api/job/:id/status', emailController.getJobStatus);
});

describe('GET /api/config', () => {
    test('returns server configuration', async () => {
        const res = await request(app).get('/api/config');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('maxConcurrentThreads');
        expect(res.body).toHaveProperty('defaultPromptPlain');
        expect(res.body).toHaveProperty('defaultPromptMarkdown');
        expect(typeof res.body.maxConcurrentThreads).toBe('number');
    });
});

describe('POST /api/ocr', () => {
    test('returns 400 when no file uploaded', async () => {
        const res = await request(app)
            .post('/api/ocr')
            .field('lang', 'eng');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No file uploaded');
    });

    test('processes a file and returns text', async () => {
        const testImagePath = path.join(__dirname, '..', 'fixtures', 'test.txt');
        const fixturesDir = path.dirname(testImagePath);
        if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
        fs.writeFileSync(testImagePath, 'test content');

        const res = await request(app)
            .post('/api/ocr')
            .attach('file', testImagePath)
            .field('lang', 'eng')
            .field('engine', 'tesseract');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('text');
        expect(res.body.text).toBe('Extracted OCR text');

        fs.unlinkSync(testImagePath);
    });
});

describe('POST /api/ocr/batch', () => {
    test('returns 400 when no files uploaded', async () => {
        const res = await request(app)
            .post('/api/ocr/batch')
            .field('lang', 'eng');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No files uploaded');
    });

    test('accepts batch files and returns success', async () => {
        const fixturesDir = path.join(__dirname, '..', 'fixtures');
        if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });

        const file1 = path.join(fixturesDir, 'batch1.txt');
        const file2 = path.join(fixturesDir, 'batch2.txt');
        fs.writeFileSync(file1, 'test1');
        fs.writeFileSync(file2, 'test2');

        const res = await request(app)
            .post('/api/ocr/batch')
            .attach('files', file1)
            .attach('files', file2)
            .field('lang', 'eng')
            .field('email', 'test@test.com');

        expect(res.status).toBe(200);
        expect(res.body.fileCount).toBe(2);

        fs.unlinkSync(file1);
        fs.unlinkSync(file2);
    });
});

describe('POST /api/download-zip', () => {
    test('returns 400 when no files in body', async () => {
        const res = await request(app)
            .post('/api/download-zip')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No content to zip');
    });

    test('returns 400 for empty files array', async () => {
        const res = await request(app)
            .post('/api/download-zip')
            .send({ files: [] });

        expect(res.status).toBe(400);
    });

    test('returns zip file for valid input', async () => {
        const res = await request(app)
            .post('/api/download-zip')
            .send({
                files: [
                    { filename: 'test.txt', text: 'Hello World' }
                ]
            });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/zip|octet-stream/);
    });
});

describe('POST /api/format-for-pdf', () => {
    test('returns 400 when no files provided', async () => {
        const res = await request(app)
            .post('/api/format-for-pdf')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No content provided for formatting');
    });

    test('returns 400 for empty files array', async () => {
        const res = await request(app)
            .post('/api/format-for-pdf')
            .send({ files: [] });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No content provided for formatting');
    });

    test('returns HTML for valid files with tesseract engine', async () => {
        const res = await request(app)
            .post('/api/format-for-pdf')
            .send({
                files: [{ filename: 'test.txt', text: 'Hello World' }],
                engine: 'tesseract',
                outputFormat: 'plain',
                lang: 'eng'
            });

        expect(res.status).toBe(200);
        expect(res.body.html).toContain('Hello World');
        expect(res.body.html).toContain('<pre>');
    });
});

describe('POST /api/otp/send', () => {
    const { db } = require('../../src/utils/supabaseClient');

    beforeEach(() => {
        db.query.mockReset();
    });

    test('returns 400 for invalid email', async () => {
        const res = await request(app)
            .post('/api/otp/send')
            .send({ email: 'invalid' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Valid email/);
    });

    test('returns 400 for empty email', async () => {
        const res = await request(app)
            .post('/api/otp/send')
            .send({});

        expect(res.status).toBe(400);
    });

    test('rate limits after too many requests', async () => {
        db.query.mockResolvedValue({ rows: [{ cnt: '10' }] });

        const res = await request(app)
            .post('/api/otp/send')
            .send({ email: 'test@example.com' });

        expect(res.status).toBe(429);
        expect(res.body.error).toMatch(/Too many requests/);
    });

    test('sends OTP successfully', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ cnt: '0' }] })
            .mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/otp/send')
            .send({ email: 'test@example.com' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('POST /api/otp/verify', () => {
    const { db } = require('../../src/utils/supabaseClient');

    beforeEach(() => {
        db.query.mockReset();
    });

    test('returns 400 for missing email or otp', async () => {
        const res = await request(app)
            .post('/api/otp/verify')
            .send({ email: 'test@example.com' });

        expect(res.status).toBe(400);
    });

    test('returns 400 for expired/invalid OTP', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const res = await request(app)
            .post('/api/otp/verify')
            .send({ email: 'test@example.com', otp: '123456' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid or expired/);
    });

    test('returns 429 for too many failed attempts', async () => {
        db.query.mockResolvedValue({
            rows: [{ id: 1, code: '999999', attempts: 5 }]
        });

        const res = await request(app)
            .post('/api/otp/verify')
            .send({ email: 'test@example.com', otp: '000000' });

        expect(res.status).toBe(429);
    });

    test('returns error for wrong code', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 1, code: '999999', attempts: 0 }] })
            .mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/otp/verify')
            .send({ email: 'test@example.com', otp: '000000' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Invalid code/);
    });

    test('verifies OTP successfully', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ id: 1, code: '999999', attempts: 0 }] })
            .mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/otp/verify')
            .send({ email: 'test@example.com', otp: '999999' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

describe('GET /api/job/active', () => {
    const { db } = require('../../src/utils/supabaseClient');

    beforeEach(() => {
        db.query.mockReset();
    });

    test('returns 400 when no email provided', async () => {
        const res = await request(app).get('/api/job/active');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Email is required.');
    });

    test('returns active: false when no active job', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const res = await request(app).get('/api/job/active?email=test@example.com');

        expect(res.status).toBe(200);
        expect(res.body.active).toBe(false);
    });

    test('returns active job when one exists', async () => {
        db.query.mockResolvedValue({
            rows: [{ id: 5, status: 'processing', file_count: 2, files_processed: 1, error: null, created_at: '2024-01-01' }]
        });

        const res = await request(app).get('/api/job/active?email=test@example.com');

        expect(res.status).toBe(200);
        expect(res.body.active).toBe(true);
        expect(res.body.job.id).toBe(5);
        expect(res.body.job.status).toBe('processing');
    });
});

describe('GET /api/job/:id/status', () => {
    const { db } = require('../../src/utils/supabaseClient');

    beforeEach(() => {
        db.query.mockReset();
    });

    test('returns 404 for non-existent job', async () => {
        db.query.mockResolvedValue({ rows: [] });

        const res = await request(app).get('/api/job/999/status');

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Job not found.');
    });

    test('returns job status', async () => {
        db.query.mockResolvedValue({
            rows: [{ status: 'processing', file_count: 3, files_processed: 1, error: null, created_at: '2024-01-01' }]
        });

        const res = await request(app).get('/api/job/1/status');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('processing');
        expect(res.body.file_count).toBe(3);
    });
});
