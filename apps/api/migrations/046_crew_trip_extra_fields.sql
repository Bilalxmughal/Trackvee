ALTER TABLE crew_trips
  ADD COLUMN IF NOT EXISTS flight_date      DATE,
  ADD COLUMN IF NOT EXISTS passenger_count  SMALLINT,
  ADD COLUMN IF NOT EXISTS notes            TEXT,
  ADD COLUMN IF NOT EXISTS display_id       INT UNIQUE DEFAULT nextval('global_display_id_seq');
