-- Migration 007: Points of Interest (POI) table
CREATE TABLE IF NOT EXISTS pois (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID,
  name       VARCHAR(100) NOT NULL,
  description TEXT,
  "group"    VARCHAR(50),
  icon       VARCHAR(50) NOT NULL DEFAULT 'map-pin',
  latitude   FLOAT NOT NULL,
  longitude  FLOAT NOT NULL,
  radius     FLOAT NOT NULL DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
