const fs = require('fs');
const path = require('path');
const os = require('os');
const { db, storage } = require('../utils/supabaseClient');
const { extractText } = require('./ocrService');
const { sendResults } = require('../utils/emailService');

const processNextJob = async (buildZip, buildPdf) => {
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

        const wantPdf = job.options?.outputFormat === 'pdf';
        let resultBuffer, resultPath, contentType, formatLabel;

        if (wantPdf && buildPdf) {
            resultBuffer = buildPdf(results, { engine: job.engine, ...job.options, lang: job.lang });
            resultPath = `${job.id}/ocr_results.html`;
            contentType = 'text/html';
            formatLabel = 'pdf';
        } else {
            resultBuffer = await buildZip(results);
            resultPath = `${job.id}/ocr_results.zip`;
            contentType = 'application/zip';
            formatLabel = 'zip';
        }

        const { error: uploadErr } = await storage
            .from('ocr-results')
            .upload(resultPath, resultBuffer, { contentType });

        if (uploadErr) throw new Error(`Failed to upload results: ${uploadErr.message}`);

        let downloadUrl;
        if (wantPdf) {
            const appUrl = (process.env.APP_URL || '').replace(/\/$/, '');
            downloadUrl = `${appUrl}/api/job/${job.id}/pdf`;
        } else {
            const { data: signedData, error: signErr } = await storage
                .from('ocr-results')
                .createSignedUrl(resultPath, 7 * 24 * 60 * 60);
            if (signErr) throw new Error(`Failed to create download link: ${signErr.message}`);
            downloadUrl = signedData.signedUrl;
        }

        await sendResults(job.email, downloadUrl, formatLabel);

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

module.exports = { processNextJob };
