-- A fleet-wide rule can be disabled for one vehicle without changing other vehicles.
ALTER TABLE alerts
  ADD COLUMN IF NOT EXISTS excluded_vehicle_imeis TEXT[] NOT NULL DEFAULT '{}';
