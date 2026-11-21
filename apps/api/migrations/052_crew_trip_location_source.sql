ALTER TABLE crew_trips
  ADD COLUMN IF NOT EXISTS checkin_location_source VARCHAR(20)
    CHECK (checkin_location_source IN ('scanner_gps', 'vehicle_tracker', 'unavailable')),
  ADD COLUMN IF NOT EXISTS checkout_location_source VARCHAR(20)
    CHECK (checkout_location_source IN ('scanner_gps', 'vehicle_tracker', 'unavailable'));
