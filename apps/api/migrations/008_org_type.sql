-- Add type column to organizations: 'b2b' = Corporate client, 'b2c' = Individual customer
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'b2b';
