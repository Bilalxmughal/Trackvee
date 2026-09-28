CREATE TABLE IF NOT EXISTS notification_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(60) NOT NULL,
  file_name VARCHAR(120) NOT NULL UNIQUE,
  mime_type VARCHAR(32) NOT NULL DEFAULT 'audio/wav',
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 30000),
  file_data BYTEA NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_notification_sounds_active_created
  ON notification_sounds(is_active, created_at DESC);

ALTER TABLE mobile_push_tokens
  ADD COLUMN IF NOT EXISTS supports_dynamic_sounds BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dynamic_sound_ids UUID[] NOT NULL DEFAULT '{}';
