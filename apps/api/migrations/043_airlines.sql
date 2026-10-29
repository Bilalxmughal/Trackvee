-- ============================================================
-- Migration 043: Airlines / Crew Tracking module
-- ============================================================

-- Dedicated sequence for crew display IDs (1001, 1002, ...)
CREATE SEQUENCE IF NOT EXISTS crew_display_id_seq START WITH 1001 INCREMENT BY 1;

-- 1. Airlines (the transport company)
CREATE TABLE IF NOT EXISTS airlines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name            VARCHAR(100) NOT NULL,
  iata_code       VARCHAR(10),
  contact_person  VARCHAR(100),
  contact_phone   VARCHAR(30),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Airline Crews (individual crew members)
CREATE TABLE IF NOT EXISTS airline_crews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id   INTEGER NOT NULL UNIQUE DEFAULT nextval('crew_display_id_seq'),
  airline_id   UUID NOT NULL REFERENCES airlines(id) ON DELETE CASCADE,
  name         VARCHAR(100) NOT NULL,
  designation  VARCHAR(100),
  stop_name    VARCHAR(200),
  stop_lat     DOUBLE PRECISION,
  stop_lng     DOUBLE PRECISION,
  nfc_card_uid VARCHAR(100) UNIQUE,
  phone        VARCHAR(30),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_airline_crews_airline_id ON airline_crews(airline_id);
CREATE INDEX IF NOT EXISTS idx_airline_crews_nfc_uid    ON airline_crews(nfc_card_uid);

-- 3. Airline Vehicles (which vehicles are assigned to this airline)
CREATE TABLE IF NOT EXISTS airline_vehicles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  airline_id UUID NOT NULL REFERENCES airlines(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (airline_id, vehicle_id)
);

CREATE INDEX IF NOT EXISTS idx_airline_vehicles_airline_id ON airline_vehicles(airline_id);

-- 4. Crew Trips (one record per crew member per ride)
CREATE TABLE IF NOT EXISTS crew_trips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id             UUID NOT NULL REFERENCES airline_crews(id) ON DELETE CASCADE,
  vehicle_id          UUID NOT NULL REFERENCES vehicles(id),
  airline_id          UUID NOT NULL REFERENCES airlines(id),
  flight_number       VARCHAR(20),
  status              VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  checkin_at          TIMESTAMPTZ,
  checkin_lat         DOUBLE PRECISION,
  checkin_lng         DOUBLE PRECISION,
  checkin_stop        VARCHAR(200),
  checkin_odometer_km NUMERIC(10,2),
  checkout_at         TIMESTAMPTZ,
  checkout_lat        DOUBLE PRECISION,
  checkout_lng        DOUBLE PRECISION,
  checkout_stop       VARCHAR(200),
  checkout_odometer_km NUMERIC(10,2),
  km_travelled        NUMERIC(10,2),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crew_trips_crew_id     ON crew_trips(crew_id);
CREATE INDEX IF NOT EXISTS idx_crew_trips_airline_id  ON crew_trips(airline_id);
CREATE INDEX IF NOT EXISTS idx_crew_trips_flight      ON crew_trips(flight_number, checkin_at);
CREATE INDEX IF NOT EXISTS idx_crew_trips_status      ON crew_trips(status);
