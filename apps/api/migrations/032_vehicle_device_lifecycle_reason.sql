ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS lifecycle_reason VARCHAR(24) NULL;

UPDATE vehicles
SET lifecycle_reason = 'manual'
WHERE lifecycle_status IN ('expired', 'archived')
  AND lifecycle_reason IS NULL;

ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_lifecycle_reason_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_lifecycle_reason_check
  CHECK (lifecycle_reason IS NULL OR lifecycle_reason IN ('manual', 'device_removed'));
