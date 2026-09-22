-- Driver Behavior Scoring tables

CREATE TABLE IF NOT EXISTS driver_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id       UUID NOT NULL,
  organization_id  UUID,
  imei             VARCHAR NOT NULL,
  type             VARCHAR NOT NULL,
  severity         VARCHAR NOT NULL DEFAULT 'medium',
  speed_kmh        FLOAT NOT NULL DEFAULT 0,
  latitude         DOUBLE PRECISION,
  longitude        DOUBLE PRECISION,
  timestamp        TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_driver_events_vehicle_ts   ON driver_events (vehicle_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_driver_events_org_ts       ON driver_events (organization_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_driver_events_vehicle_id   ON driver_events (vehicle_id);

CREATE TABLE IF NOT EXISTS driver_scores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id          UUID NOT NULL,
  organization_id     UUID,
  date                DATE NOT NULL,
  score               FLOAT NOT NULL DEFAULT 100,
  harsh_brake_count   INT NOT NULL DEFAULT 0,
  rapid_accel_count   INT NOT NULL DEFAULT 0,
  sharp_turn_count    INT NOT NULL DEFAULT 0,
  overspeed_count     INT NOT NULL DEFAULT 0,
  distance_km         FLOAT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vehicle_id, date)
);

CREATE INDEX IF NOT EXISTS idx_driver_scores_vehicle_date ON driver_scores (vehicle_id, date);
CREATE INDEX IF NOT EXISTS idx_driver_scores_org_date     ON driver_scores (organization_id, date);

-- Add driver-behavior to existing role_portal_permissions rows
UPDATE role_portal_permissions
SET permissions = jsonb_set(permissions, '{driver-behavior}', '["view","edit"]'::jsonb, true)
WHERE role IN ('client_owner', 'client_super_admin');

UPDATE role_portal_permissions
SET permissions = jsonb_set(permissions, '{driver-behavior}', '["view"]'::jsonb, true)
WHERE role IN ('client_admin', 'client_user');

CREATE TABLE IF NOT EXISTS driver_behavior_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id           UUID NOT NULL UNIQUE,
  overspeed_threshold       FLOAT NOT NULL DEFAULT 100,
  harsh_brake_deceleration  FLOAT NOT NULL DEFAULT 8,
  rapid_accel_threshold     FLOAT NOT NULL DEFAULT 6,
  sharp_turn_angle          FLOAT NOT NULL DEFAULT 45,
  sharp_turn_min_speed      FLOAT NOT NULL DEFAULT 20,
  deduction_harsh_brake     FLOAT NOT NULL DEFAULT 5,
  deduction_rapid_accel     FLOAT NOT NULL DEFAULT 3,
  deduction_sharp_turn      FLOAT NOT NULL DEFAULT 3,
  deduction_overspeed       FLOAT NOT NULL DEFAULT 5,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
