CREATE TABLE IF NOT EXISTS site_settings (
  key         VARCHAR(64)  PRIMARY KEY,
  value       JSONB        NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
