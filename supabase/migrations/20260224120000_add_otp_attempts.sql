-- Track failed OTP verification attempts for brute-force protection
ALTER TABLE otp_codes ADD COLUMN IF NOT EXISTS attempts int DEFAULT 0;
