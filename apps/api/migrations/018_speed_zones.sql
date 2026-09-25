-- 018: Speed zones — custom speed limit zones on map
-- Each zone triggers an alert when a vehicle inside exceeds its speed_limit

CREATE TABLE IF NOT EXISTS speed_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(20)  NOT NULL,
  coordinates JSONB        NOT NULL,
  speed_limit INTEGER      NOT NULL DEFAULT 60,
  color       VARCHAR(7)   NOT NULL DEFAULT '#f59e0b',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_speed_zones_org ON speed_zones(org_id);
