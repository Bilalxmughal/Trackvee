-- Add tracking_expires_at to organizations
-- When set and in the past, client's live tracking is considered expired

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS tracking_expires_at TIMESTAMPTZ DEFAULT NULL;
