const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const db = {
    query: (text, params) => pool.query(text, params),
};

const storage = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
).storage;

const storageUploadWithRetry = async (bucket, filePath, body, options, retries = 3) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        const { data, error } = await storage.from(bucket).upload(filePath, body, options);
        if (!error) return { data, error: null };
        console.warn(`Upload attempt ${attempt}/${retries} failed for ${filePath}:`, error.message);
        if (attempt < retries) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
    return storage.from(bucket).upload(filePath, body, options);
};

module.exports = { db, storage, storageUploadWithRetry };
