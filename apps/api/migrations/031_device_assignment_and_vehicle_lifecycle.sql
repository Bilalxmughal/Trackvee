-- Preserve tracker-to-vehicle ownership over time and separate vehicle lifecycle
-- from device connectivity. Legacy current assignments start at the earliest
-- stored telemetry timestamp (or device creation time if no telemetry exists).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM devices
    WHERE vehicle_id IS NOT NULL
    GROUP BY vehicle_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Migration 031 cannot backfill multiple devices assigned to one vehicle. Resolve duplicate current device assignments first.';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS device_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  organization_id UUID NULL,
  assigned_at TIMESTAMPTZ NOT NULL,
  unassigned_at TIMESTAMPTZ NULL,
  assigned_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  unassigned_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL DEFAULT 'assignment',
  reason TEXT NULL,
  odometer_km NUMERIC(12, 1) NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT device_assignments_valid_interval CHECK (unassigned_at IS NULL OR unassigned_at > assigned_at),
  CONSTRAINT device_assignments_nonnegative_odometer CHECK (odometer_km IS NULL OR odometer_km >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_device_assignments_current_device
  ON device_assignments (device_id) WHERE unassigned_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_assignments_current_vehicle
  ON device_assignments (vehicle_id) WHERE unassigned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_device_assignments_vehicle_period
  ON device_assignments (vehicle_id, assigned_at, unassigned_at);
CREATE INDEX IF NOT EXISTS idx_device_assignments_device_period
  ON device_assignments (device_id, assigned_at, unassigned_at);

INSERT INTO device_assignments (device_id, vehicle_id, organization_id, assigned_at, action, reason)
SELECT d.id, d.vehicle_id, v.organization_id,
       COALESCE((SELECT MIN(t.timestamp) FROM telemetry t WHERE t.imei = d.imei), d.created_at),
       'legacy', 'Backfilled from existing device assignment'
FROM devices d
JOIN vehicles v ON v.id = d.vehicle_id
WHERE d.vehicle_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM device_assignments a
    WHERE a.device_id = d.id AND a.unassigned_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM device_assignments a
    WHERE a.vehicle_id = d.vehicle_id AND a.unassigned_at IS NULL
  );

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR(16) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

ALTER TABLE devices ADD COLUMN IF NOT EXISTS inventory_status VARCHAR(16) NOT NULL DEFAULT 'in_stock';
UPDATE devices SET inventory_status = 'assigned'
WHERE vehicle_id IS NOT NULL AND inventory_status = 'in_stock';
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_inventory_status_check;
ALTER TABLE devices ADD CONSTRAINT devices_inventory_status_check
  CHECK (inventory_status IN ('in_stock', 'assigned', 'maintenance', 'retired'));
CREATE INDEX IF NOT EXISTS idx_devices_inventory_status ON devices (inventory_status, created_at DESC);

UPDATE vehicles SET lifecycle_status = 'archived'
WHERE is_active = FALSE AND lifecycle_status = 'active';
ALTER TABLE vehicles DROP CONSTRAINT IF EXISTS vehicles_lifecycle_status_check;
ALTER TABLE vehicles ADD CONSTRAINT vehicles_lifecycle_status_check
  CHECK (lifecycle_status IN ('active', 'expired', 'archived'));
CREATE INDEX IF NOT EXISTS idx_vehicles_lifecycle_org ON vehicles (organization_id, lifecycle_status);
