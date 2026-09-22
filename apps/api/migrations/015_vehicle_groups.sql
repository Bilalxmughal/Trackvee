-- Vehicle groups (DB-backed, replaces localStorage groups from map)

CREATE TABLE IF NOT EXISTS vehicle_groups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_groups_org ON vehicle_groups(organization_id);

-- One vehicle → one group (UNIQUE on vehicle_id enforces this)
CREATE TABLE IF NOT EXISTS vehicle_group_memberships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL UNIQUE REFERENCES vehicles(id) ON DELETE CASCADE,
  group_id   UUID NOT NULL REFERENCES vehicle_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vgm_group ON vehicle_group_memberships(group_id);

-- Driver behavior settings: add group and vehicle scope columns
ALTER TABLE driver_behavior_settings
  ADD COLUMN IF NOT EXISTS group_id   UUID REFERENCES vehicle_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id)        ON DELETE CASCADE;

-- Drop old simple UNIQUE constraint on organization_id (was created by TypeORM)
ALTER TABLE driver_behavior_settings DROP CONSTRAINT IF EXISTS driver_behavior_settings_organization_id_key;

-- Partial unique indexes for each scope level
CREATE UNIQUE INDEX IF NOT EXISTS uq_dbs_org_default
  ON driver_behavior_settings (organization_id)
  WHERE group_id IS NULL AND vehicle_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dbs_group
  ON driver_behavior_settings (group_id)
  WHERE group_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dbs_vehicle
  ON driver_behavior_settings (vehicle_id)
  WHERE vehicle_id IS NOT NULL;

-- Expose vehicle-groups feature in client portal permissions
UPDATE role_portal_permissions
SET permissions = jsonb_set(permissions, '{vehicle-groups}', '["view","edit"]'::jsonb, true)
WHERE role IN ('client_owner', 'client_super_admin');

UPDATE role_portal_permissions
SET permissions = jsonb_set(permissions, '{vehicle-groups}', '["view"]'::jsonb, true)
WHERE role IN ('client_admin', 'client_user');
