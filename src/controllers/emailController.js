const crypto = require('crypto');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db, storage } = require('../utils/supabaseClient');
const { sendOTP } = require('../utils/emailService');

const OTP_EXPIRY_MINUTES = 5;
const OTP_RATE_LIMIT = 5;
const OTP_MAX_ATTEMPTS = 5;

exports.sendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Valid email is required.' });
        }

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { rows } = await db.query(
            'SELECT COUNT(*) as cnt FROM otp_codes WHERE email = $1 AND created_at >= $2',
            [email, oneHourAgo]
        );

        if (parseInt(rows[0].cnt) >= OTP_RATE_LIMIT) {
            return res.status(429).json({ error: 'Too many requests. Try again later.' });
        }

        const isDev = process.env.OCR_DEV_OTP === 'true';
        const code = isDev ? '999999' : crypto.randomInt(100000, 999999).toString();
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

        await db.query(
            'INSERT INTO otp_codes (email, code, expires_at) VALUES ($1, $2, $3)',
            [email, code, expiresAt]
        );

        if (isDev) console.log(`[DEV] OTP for ${email}: ${code}`);
        else await sendOTP(email, code);
        res.json({ success: true });
    } catch (err) {
        console.error('OTP send error:', err);
        res.status(500).json({ error: 'Failed to send verification code.' });
    }
};

exports.verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: 'Email and code are required.' });
        }

        const now = new Date().toISOString();

        const { rows: otpRows } = await db.query(
            `SELECT id, code, attempts FROM otp_codes
             WHERE email = $1 AND verified = false AND expires_at >= $2
             ORDER BY created_at DESC LIMIT 1`,
            [email, now]
        );

        if (otpRows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }

        const otpRecord = otpRows[0];

        if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
            return res.status(429).json({ error: 'Too many failed attempts. Request a new code.' });
        }

        if (otpRecord.code !== otp) {
            await db.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
            const remaining = OTP_MAX_ATTEMPTS - otpRecord.attempts - 1;
            return res.status(400).json({
                error: remaining > 0
                    ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                    : 'Too many failed attempts. Request a new code.',
            });
        }

        await db.query('UPDATE otp_codes SET verified = true WHERE id = $1', [otpRecord.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('OTP verify error:', err);
        res.status(500).json({ error: 'Verification failed.' });
    }
};

exports.createJob = async (req, res) => {
    try {
        const email = (req.body.email || '').trim();
        const lang = req.body.lang || 'eng+ben';
        const engine = req.body.engine || 'tesseract';

        if (!email) return res.status(400).json({ error: 'Email is required.' });
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded.' });

        const { rows: verifiedOtp } = await db.query(
            `SELECT id FROM otp_codes WHERE email = $1 AND verified = true
             AND created_at >= NOW() - INTERVAL '15 minutes' LIMIT 1`,
            [email]
        );
        if (verifiedOtp.length === 0) {
            if (req.files) req.files.forEach(f => fs.unlink(f.path, () => {}));
            return res.status(403).json({ error: 'Email not verified. Please verify your email first.' });
        }

        const options = {
            googleApiKey: (req.body.googleApiKey || '').trim(),
            openRouterApiKey: (req.body.openRouterApiKey || '').trim(),
            openRouterOutputFormat: (req.body.openRouterOutputFormat || 'plain').trim(),
            openRouterCustomModel: (req.body.openRouterCustomModel || '').trim(),
            customPrompt: (req.body.customPrompt || '').trim(),
            skipPreprocessing: req.body.skipPreprocessing === 'true' || req.body.skipPreprocessing === true,
        };

        const { rows: jobRows } = await db.query(
            `INSERT INTO ocr_jobs (email, lang, engine, options, file_count, status)
             VALUES ($1, $2, $3, $4, $5, 'uploading') RETURNING id`,
            [email, lang, engine, JSON.stringify(options), req.files.length]
        );
        const jobId = jobRows[0].id;

        const fileRows = [];
        for (const file of req.files) {
            const fileBuffer = fs.readFileSync(file.path);
            const safeName = file.originalname.replace(/[^a-zA-Z0-9_\-.\u0980-\u09FF]/g, '_').slice(0, 200);
            const storagePath = `${jobId}/${uuidv4()}_${safeName}`;

            const { error: uploadErr } = await storage
                .from('ocr-uploads')
                .upload(storagePath, fileBuffer, { contentType: file.mimetype });

            if (uploadErr) {
                console.error(`Upload failed for ${file.originalname}:`, uploadErr);
                continue;
            }

            fileRows.push([jobId, file.originalname, storagePath, file.mimetype]);
            fs.unlink(file.path, () => {});
        }

        if (fileRows.length === 0) {
            await db.query("UPDATE ocr_jobs SET status = 'failed', error = 'All file uploads failed.' WHERE id = $1", [jobId]);
            return res.status(500).json({ error: 'Failed to upload files.' });
        }

        const placeholders = fileRows.map((_, i) => {
            const offset = i * 4;
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`;
        }).join(', ');
        const flatValues = fileRows.flat();
        await db.query(
            `INSERT INTO ocr_job_files (job_id, original_name, storage_path, mimetype) VALUES ${placeholders}`,
            flatValues
        );

        if (fileRows.length !== req.files.length) {
            await db.query("UPDATE ocr_jobs SET status = 'pending', file_count = $1, updated_at = NOW() WHERE id = $2", [fileRows.length, jobId]);
        } else {
            await db.query("UPDATE ocr_jobs SET status = 'pending', updated_at = NOW() WHERE id = $1", [jobId]);
        }

        res.json({ success: true, jobId });
    } catch (err) {
        console.error('Job creation error:', err);
        if (req.files) {
            req.files.forEach(f => fs.unlink(f.path, () => {}));
        }
        res.status(500).json({ error: 'Failed to create job.' });
    }
};

exports.getJobStatus = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ error: 'Job ID required.' });

        const { rows } = await db.query(
            'SELECT status, file_count, files_processed, error, created_at FROM ocr_jobs WHERE id = $1',
            [id]
        );

        if (rows.length === 0) return res.status(404).json({ error: 'Job not found.' });
        res.json(rows[0]);
    } catch (err) {
        console.error('Job status error:', err);
        res.status(500).json({ error: 'Failed to get job status.' });
    }
};
