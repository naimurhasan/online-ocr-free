const fs = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const { db, storage } = require('../utils/supabaseClient');
const { extractText } = require('./ocrService');
const { sendResults } = require('../utils/emailService');

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
        await processNextJob();
    } catch (err) {
        console.error('Job worker poll error:', err);
    }
    setTimeout(poll, POLL_INTERVAL_MS);
};

const processNextJob = async () => {
    const { rows: jobs } = await db.query(
        `UPDATE ocr_jobs SET status = 'processing', started_at = NOW(), updated_at = NOW()
         WHERE id = (SELECT id FROM ocr_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1)
         RETURNING *`
    );

    if (jobs.length === 0) return;

    const job = jobs[0];
    console.log(`📋 Processing job ${job.id} for ${job.email} (${job.file_count} files)`);

    try {
        const { rows: jobFiles } = await db.query(
            "SELECT * FROM ocr_job_files WHERE job_id = $1 AND status = 'pending'",
            [job.id]
        );

        if (jobFiles.length === 0) throw new Error('No files found for job');

        const results = [];
        let filesProcessed = 0;

        for (const jf of jobFiles) {
            try {
                await db.query("UPDATE ocr_job_files SET status = 'processing' WHERE id = $1", [jf.id]);

                const { data: fileData, error: dlErr } = await storage
                    .from('ocr-uploads')
                    .download(jf.storage_path);

                if (dlErr) throw dlErr;

                const tmpDir = path.join(os.tmpdir(), 'ocr-jobs');
                fs.mkdirSync(tmpDir, { recursive: true });
                const tmpFile = path.join(tmpDir, `${jf.id}_${jf.original_name}`);
                const buffer = Buffer.from(await fileData.arrayBuffer());
                fs.writeFileSync(tmpFile, buffer);

                const text = await extractText(tmpFile, jf.mimetype, job.lang, false, {
                    engine: job.engine,
                    ...job.options,
                });

                await db.query(
                    "UPDATE ocr_job_files SET status = 'done', result_text = $1 WHERE id = $2",
                    [text, jf.id]
                );

                results.push({ filename: jf.original_name, text });
                filesProcessed++;

                await db.query(
                    'UPDATE ocr_jobs SET files_processed = $1, updated_at = NOW() WHERE id = $2',
                    [filesProcessed, job.id]
                );

                fs.unlink(tmpFile, () => {});
            } catch (fileErr) {
                console.error(`  Error processing ${jf.original_name}:`, fileErr.message);
                await db.query(
                    "UPDATE ocr_job_files SET status = 'failed', error = $1 WHERE id = $2",
                    [fileErr.message, jf.id]
                );
                results.push({ filename: jf.original_name, text: `[Error: ${fileErr.message}]` });
                filesProcessed++;

                const tmpFile = path.join(os.tmpdir(), 'ocr-jobs', `${jf.id}_${jf.original_name}`);
                fs.unlink(tmpFile, () => {});
            }
        }

        const zipBuffer = await buildZip(results);

        const resultPath = `${job.id}/ocr_results.zip`;
        const { error: uploadErr } = await storage
            .from('ocr-results')
            .upload(resultPath, zipBuffer, { contentType: 'application/zip' });

        if (uploadErr) throw new Error(`Failed to upload result ZIP: ${uploadErr.message}`);

        const { data: signedData, error: signErr } = await storage
            .from('ocr-results')
            .createSignedUrl(resultPath, 7 * 24 * 60 * 60);

        if (signErr) throw new Error(`Failed to create download link: ${signErr.message}`);

        await sendResults(job.email, signedData.signedUrl);

        await db.query(
            `UPDATE ocr_jobs SET status = 'done', files_processed = $1, result_path = $2,
             completed_at = NOW(), updated_at = NOW() WHERE id = $3`,
            [filesProcessed, resultPath, job.id]
        );

        const filePaths = jobFiles.map(f => f.storage_path);
        await storage.from('ocr-uploads').remove(filePaths);

        console.log(`✅ Job ${job.id} completed — download link emailed to ${job.email}`);
    } catch (err) {
        console.error(`❌ Job ${job.id} failed:`, err.message);
        await db.query(
            "UPDATE ocr_jobs SET status = 'failed', error = $1, updated_at = NOW() WHERE id = $2",
            [err.message, job.id]
        );

        try {
            const { rows: failedFiles } = await db.query(
                'SELECT storage_path FROM ocr_job_files WHERE job_id = $1',
                [job.id]
            );
            if (failedFiles.length > 0) {
                await storage.from('ocr-uploads').remove(failedFiles.map(f => f.storage_path));
            }
        } catch (cleanupErr) {
            console.error(`Cleanup error for job ${job.id}:`, cleanupErr.message);
        }
    }
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

const recoverStuckJobs = async () => {
    try {
        await db.query("UPDATE ocr_jobs SET status = 'pending', updated_at = NOW() WHERE status = 'processing'");
        console.log('🔧 Recovered any stuck processing jobs');
    } catch (err) {
        console.error('Failed to recover stuck jobs:', err);
    }
};

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

const startCleanupSchedule = () => {
    setInterval(runCleanup, CLEANUP_INTERVAL_MS);
    setTimeout(runCleanup, 30000);
};

const runCleanup = async () => {
    try {
        const { rows: expiredJobs } = await db.query(
            `SELECT id, result_path FROM ocr_jobs
             WHERE status IN ('done', 'failed') AND completed_at < NOW() - INTERVAL '7 days'`
        );

        if (expiredJobs.length > 0) {
            const resultPaths = expiredJobs.filter(j => j.result_path).map(j => j.result_path);
            if (resultPaths.length > 0) {
                await storage.from('ocr-results').remove(resultPaths);
            }

            const jobIds = expiredJobs.map(j => j.id);
            await db.query('DELETE FROM ocr_job_files WHERE job_id = ANY($1)', [jobIds]);
            await db.query('DELETE FROM ocr_jobs WHERE id = ANY($1)', [jobIds]);

            console.log(`🧹 Cleaned up ${expiredJobs.length} expired jobs`);
        }

        const { rowCount: otpCount } = await db.query(
            "DELETE FROM otp_codes WHERE created_at < NOW() - INTERVAL '1 day'"
        );
        if (otpCount > 0) {
            console.log(`🧹 Cleaned up ${otpCount} old OTP codes`);
        }

        const { rows: staleUploads } = await db.query(
            `SELECT id FROM ocr_jobs WHERE status = 'uploading' AND created_at < NOW() - INTERVAL '1 hour'`
        );
        if (staleUploads.length > 0) {
            const staleIds = staleUploads.map(j => j.id);
            const { rows: staleFiles } = await db.query(
                'SELECT storage_path FROM ocr_job_files WHERE job_id = ANY($1)',
                [staleIds]
            );
            if (staleFiles.length > 0) {
                await storage.from('ocr-uploads').remove(staleFiles.map(f => f.storage_path));
            }
            await db.query('DELETE FROM ocr_job_files WHERE job_id = ANY($1)', [staleIds]);
            await db.query('DELETE FROM ocr_jobs WHERE id = ANY($1)', [staleIds]);
            console.log(`🧹 Cleaned up ${staleUploads.length} stale uploading jobs`);
        }
    } catch (err) {
        console.error('Cleanup error:', err.message);
    }
};

module.exports = { start, recoverStuckJobs, startCleanupSchedule };
