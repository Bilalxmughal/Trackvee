CREATE UNIQUE INDEX IF NOT EXISTS ux_vehicles_organization_id_id
  ON vehicles (organization_id, id);

CREATE TABLE IF NOT EXISTS maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL,
  service_type VARCHAR(80) NOT NULL,
  service_date DATE NOT NULL,
  odometer_km NUMERIC(12,1),
  provider VARCHAR(120),
  cost NUMERIC(12,2),
  notes TEXT,
  next_due_date DATE,
  next_due_odometer_km NUMERIC(12,1),
  reminder_days_before INTEGER NOT NULL DEFAULT 30 CHECK (reminder_days_before BETWEEN 0 AND 365),
  reminder_km_before INTEGER NOT NULL DEFAULT 500 CHECK (reminder_km_before BETWEEN 0 AND 100000),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (odometer_km IS NULL OR odometer_km >= 0),
  CHECK (cost IS NULL OR cost >= 0),
  CHECK (next_due_odometer_km IS NULL OR next_due_odometer_km >= 0),
  CONSTRAINT fk_maintenance_records_org_vehicle
    FOREIGN KEY (organization_id, vehicle_id)
    REFERENCES vehicles (organization_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_maintenance_records_org_vehicle_date
  ON maintenance_records (organization_id, vehicle_id, service_date DESC);

ALTER TABLE org_user_permissions
  ADD COLUMN IF NOT EXISTS maintenance_view BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS maintenance_add BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS maintenance_edit BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS maintenance_delete BOOLEAN DEFAULT NULL;

UPDATE role_portal_permissions
SET permissions = permissions || jsonb_build_object('maintenance',
  CASE role
    WHEN 'client_owner' THEN '["view", "add", "edit", "delete"]'::jsonb
    WHEN 'client_super_admin' THEN '["view", "add", "edit", "delete"]'::jsonb
    WHEN 'client_admin' THEN '["view", "add", "edit"]'::jsonb
    ELSE '["view"]'::jsonb
  END)
WHERE role IN ('client_owner', 'client_super_admin', 'client_admin', 'client_user')
  AND NOT (permissions ? 'maintenance');
