ALTER TABLE airline_vehicles
  ADD COLUMN IF NOT EXISTS active_session_id UUID;
