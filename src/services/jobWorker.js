const archiver = require('archiver');
const { db } = require('../utils/supabaseClient');
const { processNextJob } = require('./jobProcessor');
const { startCleanupSchedule } = require('./jobCleanup');
const { buildPdfHtml } = require('../utils/markdownToHtml');

const POLL_INTERVAL_MS = 5000;
let running = false;

const start = () => {
    if (running) return;
    running = true;
    console.log('🔄 Job worker started');
    poll();
};

const poll = async () => {
    if (!running) return;
    try {
        await processNextJob(buildZip, buildPdf);
    } catch (err) {
        console.error('Job worker poll error:', err);
    }
    setTimeout(poll, POLL_INTERVAL_MS);
};

const buildZip = (results) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('data', chunk => chunks.push(chunk));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', reject);

        for (const r of results) {
            if (r.filename && r.text) {
                const name = r.filename.replace(/\.[^.]+$/, '') + '.txt';
                archive.append(r.text, { name });
            }
        }
        archive.finalize();
    });
};

const buildPdf = (results, jobOptions = {}) => {
    const engine = jobOptions.engine || 'tesseract';
    const outputFormat = jobOptions.openRouterOutputFormat || 'plain';
    const lang = jobOptions.lang || 'eng';
    const html = buildPdfHtml(results, { engine, outputFormat, lang });
    return Buffer.from(html, 'utf-8');
};

const recoverStuckJobs = async () => {
    try {
        await db.query("UPDATE ocr_jobs SET status = 'pending', updated_at = NOW() WHERE status = 'processing'");
        console.log('🔧 Recovered any stuck processing jobs');
    } catch (err) {
        console.error('Failed to recover stuck jobs:', err);
    }
};

module.exports = { start, recoverStuckJobs, startCleanupSchedule };
