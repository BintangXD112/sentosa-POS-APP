-- Migration: 002_password_reset_and_emails.sql
-- Update user emails and add password reset tokens table

-- 1. Update user emails
UPDATE users SET email = 'bintanggtps18@gmail.com' WHERE username = 'owner';
UPDATE users SET email = 'bintangxd19@gmail.com'  WHERE username = 'manager';
UPDATE users SET email = 'bintangxd172@gmail.com'  WHERE username = 'cashier';
UPDATE users SET email = 'bintangxd199@gmail.com'  WHERE username = 'inventory';

-- 2. Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_token_hash  ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_id     ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_expires_at  ON password_reset_tokens(expires_at);
