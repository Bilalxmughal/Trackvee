CREATE TABLE IF NOT EXISTS airline_airports (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id      INT          UNIQUE DEFAULT nextval('global_display_id_seq'),
  organization_id UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            VARCHAR(200) NOT NULL,
  iata_code       VARCHAR(10),
  city_id         UUID         REFERENCES cities(id) ON DELETE SET NULL,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
