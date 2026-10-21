-- Migration: 005_two_factor_and_trusted_devices.sql
-- 2FA OTP challenges, 30-day trusted devices, and audit log columns

-- 1. Trusted devices (valid up to 30 days)
CREATE TABLE IF NOT EXISTS trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_token TEXT NOT NULL,
    device_name TEXT,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_device_token UNIQUE(user_id, device_token)
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_lookup ON trusted_devices(user_id, device_token, expires_at);

-- 2. Two-factor authentication OTP challenges (expires in 10 minutes)
CREATE TABLE IF NOT EXISTS two_factor_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_token TEXT NOT NULL UNIQUE,
    code_hash TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    attempts INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_2fa_challenge_token ON two_factor_challenges(challenge_token);

-- 3. Enhance audit_logs with ip_address and user_agent
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent TEXT;
