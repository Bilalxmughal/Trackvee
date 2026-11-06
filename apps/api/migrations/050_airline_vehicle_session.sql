-- Track vehicle tablet login sessions
ALTER TABLE airline_vehicles
  ADD COLUMN IF NOT EXISTS last_login_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_revoked_at TIMESTAMPTZ;
