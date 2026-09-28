ALTER TABLE mobile_push_tokens
  ADD COLUMN IF NOT EXISTS supports_custom_sounds BOOLEAN NOT NULL DEFAULT FALSE;
