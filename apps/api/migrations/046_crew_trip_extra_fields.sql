ALTER TABLE crew_trips
  ADD COLUMN IF NOT EXISTS flight_date      DATE,
  ADD COLUMN IF NOT EXISTS passenger_count  SMALLINT,
  ADD COLUMN IF NOT EXISTS notes            TEXT;
