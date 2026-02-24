const { db, storage } = require('../utils/supabaseClient');

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

module.exports = { startCleanupSchedule };
