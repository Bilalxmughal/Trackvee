-- Migration 001: Initial schema

CREATE SEQUENCE IF NOT EXISTS global_display_id_seq START 1000;

-- Cities
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id INT UNIQUE DEFAULT nextval('global_display_id_seq'),
  name VARCHAR NOT NULL,
  province VARCHAR,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id INT UNIQUE DEFAULT nextval('global_display_id_seq'),
  name VARCHAR NOT NULL,
  company_name VARCHAR,
  poc_name VARCHAR,
  contact_no VARCHAR,
  email VARCHAR,
  slug VARCHAR NOT NULL UNIQUE,
  owner_id UUID NOT NULL,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  type VARCHAR(10) NOT NULL DEFAULT 'b2b',
  is_active BOOLEAN NOT NULL DEFAULT true,
  tracking_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users
CREATE TYPE IF NOT EXISTS user_role AS ENUM (
  'super_admin','admin','ops','live_ops','agent','chat_support','viewer',
  'client_owner','client_super_admin','client_admin','client_user'
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id INT UNIQUE DEFAULT nextval('global_display_id_seq'),
  email VARCHAR NOT NULL UNIQUE,
  password VARCHAR NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  role user_role NOT NULL DEFAULT 'client_user',
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ DEFAULT NULL,
  token_version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vehicles
CREATE TYPE IF NOT EXISTS vehicle_type AS ENUM ('car','motorcycle','truck','van','bus','other');

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id INT UNIQUE DEFAULT nextval('global_display_id_seq'),
  name VARCHAR NOT NULL,
  license_plate VARCHAR,
  make VARCHAR,
  model VARCHAR,
  year INT,
  type vehicle_type NOT NULL DEFAULT 'car',
  owner_id UUID NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  lifecycle_status VARCHAR(16) NOT NULL DEFAULT 'active',
  lifecycle_reason VARCHAR(24),
  expires_at TIMESTAMPTZ,
  odometer_km NUMERIC(10,2) NOT NULL DEFAULT 0,
  odo_base_lat DOUBLE PRECISION,
  odo_base_lng DOUBLE PRECISION,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Devices
CREATE TYPE IF NOT EXISTS device_status AS ENUM ('active','inactive','unassigned','offline');

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id INT UNIQUE DEFAULT nextval('global_display_id_seq'),
  imei VARCHAR NOT NULL UNIQUE,
  name VARCHAR,
  sim_number VARCHAR,
  status device_status NOT NULL DEFAULT 'offline',
  inventory_status VARCHAR(16) NOT NULL DEFAULT 'in_stock',
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  last_seen_at TIMESTAMPTZ,
  last_ignition BOOLEAN,
  last_external_power BOOLEAN,
  last_immobilizer BOOLEAN,
  last_voltage_level INT,
  last_gsm_signal INT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Telemetry
CREATE TABLE IF NOT EXISTS telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID,
  imei VARCHAR NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed_kmh FLOAT NOT NULL DEFAULT 0,
  heading INT NOT NULL DEFAULT 0,
  satellites INT NOT NULL DEFAULT 0,
  gps_valid BOOLEAN NOT NULL DEFAULT false,
  ignition BOOLEAN,
  external_power BOOLEAN,
  immobilizer BOOLEAN,
  voltage_level INT,
  gsm_signal INT,
  altitude FLOAT,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telemetry_imei ON telemetry(imei);
CREATE INDEX IF NOT EXISTS idx_telemetry_imei_timestamp ON telemetry(imei, timestamp);

-- Geofences
CREATE TABLE IF NOT EXISTS geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL,
  coordinates JSONB NOT NULL,
  color VARCHAR(7) NOT NULL DEFAULT '#dc2626',
  trigger_on_enter BOOLEAN NOT NULL DEFAULT true,
  trigger_on_exit BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  vehicle_imeis TEXT[] NOT NULL DEFAULT '{}',
  excluded_vehicle_imeis TEXT[] NOT NULL DEFAULT '{}',
  schedule JSONB,
  notifications JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alert logs
CREATE TABLE IF NOT EXISTS alert_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL,
  imei VARCHAR(20) NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'
);
