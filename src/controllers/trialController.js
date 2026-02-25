const crypto = require('crypto');
const { db } = require('../utils/supabaseClient');

const ALLOWED_EMAIL_DOMAINS = new Set([
    'gmail.com', 'googlemail.com',
    'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.fr', 'yahoo.de', 'yahoo.es', 'yahoo.it', 'yahoo.ca', 'yahoo.com.au',
    'outlook.com', 'outlook.co.uk', 'outlook.fr', 'outlook.de', 'outlook.es', 'outlook.it', 'outlook.com.au',
    'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.es', 'hotmail.it',
    'live.com', 'live.co.uk', 'live.fr', 'live.de', 'live.com.au',
    'microsoft.com',
    'proton.me', 'protonmail.com', 'protonmail.ch',
    'icloud.com', 'me.com', 'mac.com',
    'aol.com',
    'zoho.com',
    'yandex.com', 'yandex.ru',
    'mail.com',
    'gmx.com', 'gmx.net', 'gmx.de',
    'tutanota.com', 'tuta.io',
    'fastmail.com', 'fastmail.fm',
    'hey.com',
]);

const isAllowedEmailDomain = (email) => {
    const domain = email.split('@')[1]?.toLowerCase();
    return domain && ALLOWED_EMAIL_DOMAINS.has(domain);
};

exports.claimTrialKey = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'Valid email is required.' });
        }
        if (!isAllowedEmailDomain(email)) {
            return res.status(400).json({ error: 'Free trial is only available for personal email addresses (Gmail, Outlook, Yahoo, ProtonMail, iCloud, etc.).' });
        }
        if (!otp) {
            return res.status(400).json({ error: 'Verification code is required.' });
        }

        // Verify OTP inline — check unverified first, then fall back to recently-verified
        // (in case a previous attempt verified the OTP but failed before inserting the key)
        const now = new Date().toISOString();
        const { rows: otpRows } = await db.query(
            `SELECT id, code, attempts, verified FROM otp_codes
             WHERE email = $1 AND expires_at >= $2
             ORDER BY created_at DESC LIMIT 1`,
            [email, now]
        );
        if (otpRows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired code.' });
        }
        const otpRecord = otpRows[0];

        if (!otpRecord.verified) {
            // OTP not yet verified — validate the code
            if (otpRecord.attempts >= 5) {
                return res.status(429).json({ error: 'Too many failed attempts. Request a new code.' });
            }
            if (otpRecord.code !== otp) {
                await db.query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
                const remaining = 5 - otpRecord.attempts - 1;
                return res.status(400).json({
                    error: remaining > 0
                        ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
                        : 'Too many failed attempts. Request a new code.',
                });
            }
            // Code is correct — do NOT mark verified yet; do it after successful key creation
        } else {
            // OTP already verified by a prior attempt — allow retry but still check the code matches
            if (otpRecord.code !== otp) {
                return res.status(400).json({ error: 'Invalid code.' });
            }
        }

        // Check if email already has a key (idempotent)
        const { rows: existingRows } = await db.query(
            'SELECT trial_key, credits_used, credits_total FROM trial_keys WHERE email = $1',
            [email]
        );
        if (existingRows.length > 0) {
            const existing = existingRows[0];
            return res.json({
                trialKey: existing.trial_key,
                creditsTotal: existing.credits_total,
                creditsUsed: existing.credits_used,
            });
        }

        // Check global slot availability
        const { rows: slotRows } = await db.query(
            'SELECT claimed, max_slots FROM trial_slots WHERE id = 1'
        );
        if (slotRows.length === 0) {
            return res.status(500).json({ error: 'Trial system not configured.' });
        }
        const slots = slotRows[0];
        if (parseInt(slots.claimed) >= parseInt(slots.max_slots)) {
            return res.status(429).json({ error: 'All free trial slots are taken. Check back later.' });
        }

        // Generate trial key
        const prefix = process.env.TRIAL_KEY_PREFIX || 'ocrmtrial_';
        const trialKey = prefix + crypto.randomBytes(16).toString('hex');

        // Insert trial key and increment slot count
        await db.query(
            `INSERT INTO trial_keys (email, trial_key, engine, credits_total, credits_used)
             VALUES ($1, $2, 'google-vision', 100, 0)`,
            [email, trialKey]
        );
        await db.query(
            'UPDATE trial_slots SET claimed = claimed + 1 WHERE id = 1'
        );

        // Mark OTP verified only after everything succeeded
        if (!otpRecord.verified) {
            await db.query('UPDATE otp_codes SET verified = true WHERE id = $1', [otpRecord.id]);
        }

        return res.json({ trialKey, creditsTotal: 100, creditsUsed: 0 });
    } catch (err) {
        console.error('Trial claim error:', err);
        res.status(500).json({ error: 'Failed to claim trial key.' });
    }
};

exports.getTrialStatus = async (req, res) => {
    try {
        const email = (req.query.email || '').trim();
        if (!email) return res.status(400).json({ error: 'Email is required.' });
        if (!isAllowedEmailDomain(email)) return res.json({ hasKey: false });

        const { rows } = await db.query(
            'SELECT trial_key, credits_used, credits_total FROM trial_keys WHERE email = $1',
            [email]
        );

        if (rows.length === 0) {
            return res.json({ hasKey: false });
        }

        const record = rows[0];
        return res.json({
            hasKey: true,
            trialKey: record.trial_key,
            creditsUsed: record.credits_used,
            creditsTotal: record.credits_total,
        });
    } catch (err) {
        console.error('Trial status error:', err);
        res.status(500).json({ error: 'Failed to get trial status.' });
    }
};
