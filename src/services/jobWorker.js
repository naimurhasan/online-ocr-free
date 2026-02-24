const archiver = require('archiver');
const { db } = require('../utils/supabaseClient');
const { processNextJob } = require('./jobProcessor');
const { startCleanupSchedule } = require('./jobCleanup');

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

const escapeHtml = (text) => {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

const buildPdf = (results) => {
    const sections = results
        .filter(r => r.filename && r.text)
        .map(r => {
            const name = escapeHtml(r.filename);
            const text = escapeHtml(r.text);
            return `<div class="section"><h2>${name}</h2><pre>${text}</pre></div>`;
        })
        .join('\n<div class="page-break"></div>\n');

    const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><title>OCR Results</title>
<style>
  body { margin: 0; padding: 40px; font-family: 'Noto Sans Bengali', 'Noto Sans', Arial, sans-serif; font-size: 14px; line-height: 1.8; color: #000; background: #fff; }
  h2 { color: #333; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; }
  pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: 12px; line-height: 1.6; }
  .page-break { page-break-after: always; }
  @media print { body { padding: 20px; } .no-print { display: none; } }
</style>
<script>
  // Auto-open print dialog once fonts and content are ready
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() { setTimeout(function() { window.print(); }, 300); });
  } else {
    window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 300); });
  }
</script>
</head><body>
<div class="no-print" style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:16px;margin-bottom:24px;text-align:center;">
  <p style="margin:0 0 8px;font-size:15px;color:#0369a1;"><strong>Save as PDF:</strong> Select "Save as PDF" as the destination in the print dialog.</p>
  <button onclick="window.print()" style="padding:10px 24px;background:#111827;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">Print / Save as PDF</button>
</div>
${sections}
</body></html>`;

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
