-- Trial keys: one per email, tracks credits for free Google Vision trial
CREATE TABLE IF NOT EXISTS trial_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    trial_key TEXT UNIQUE NOT NULL,
    engine TEXT NOT NULL DEFAULT 'google-vision',
    credits_total INTEGER NOT NULL DEFAULT 100,
    credits_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trial slots: single row tracks global claimed count vs max allowed
CREATE TABLE IF NOT EXISTS trial_slots (
    id INTEGER PRIMARY KEY,
    claimed INTEGER NOT NULL DEFAULT 0,
    max_slots INTEGER NOT NULL DEFAULT 50
);

INSERT INTO trial_slots (id, claimed, max_slots)
VALUES (1, 0, 50)
ON CONFLICT (id) DO NOTHING;
