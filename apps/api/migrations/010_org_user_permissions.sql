CREATE TABLE IF NOT EXISTS org_user_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Vehicles module
  vehicles_view   BOOLEAN NOT NULL DEFAULT true,
  vehicles_add    BOOLEAN NOT NULL DEFAULT false,
  vehicles_edit   BOOLEAN NOT NULL DEFAULT false,
  vehicles_delete BOOLEAN NOT NULL DEFAULT false,

  -- Alerts module
  alerts_view     BOOLEAN NOT NULL DEFAULT true,
  alerts_add      BOOLEAN NOT NULL DEFAULT true,
  alerts_edit     BOOLEAN NOT NULL DEFAULT true,
  alerts_delete   BOOLEAN NOT NULL DEFAULT false,

  -- Geofences module
  geofences_view   BOOLEAN NOT NULL DEFAULT true,
  geofences_add    BOOLEAN NOT NULL DEFAULT true,
  geofences_edit   BOOLEAN NOT NULL DEFAULT true,
  geofences_delete BOOLEAN NOT NULL DEFAULT false,

  -- POIs module
  pois_view   BOOLEAN NOT NULL DEFAULT true,
  pois_add    BOOLEAN NOT NULL DEFAULT true,
  pois_edit   BOOLEAN NOT NULL DEFAULT true,
  pois_delete BOOLEAN NOT NULL DEFAULT false,

  -- Specific vehicle access (NULL = all org vehicles)
  vehicle_ids TEXT[] DEFAULT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_org_user_permissions UNIQUE (user_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_user_permissions_user  ON org_user_permissions (user_id);
CREATE INDEX IF NOT EXISTS idx_org_user_permissions_org   ON org_user_permissions (org_id);
