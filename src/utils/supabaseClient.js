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

module.exports = { db, storage };
