-- Migration: 003_store_settings.sql
-- Add store phone, address, and receipt_footer to businesses

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone VARCHAR(50) DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS receipt_footer TEXT DEFAULT 'Terima kasih atas kunjungan Anda!';
