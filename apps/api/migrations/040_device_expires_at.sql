-- Add expires_at column to devices table for subscription/validity tracking
ALTER TABLE devices ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient expiring device queries
CREATE INDEX IF NOT EXISTS idx_devices_expires_at ON devices (expires_at) WHERE expires_at IS NOT NULL;
