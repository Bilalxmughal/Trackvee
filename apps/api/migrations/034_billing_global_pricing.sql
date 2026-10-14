-- Global pricing config (single row) + activity charge types

CREATE TABLE IF NOT EXISTS global_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  installation_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  removal_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  transfer_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  reactivation_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  monthly_fixed_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  threshold_enabled BOOLEAN NOT NULL DEFAULT true,
  threshold_days INTEGER NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO global_pricing (id) SELECT gen_random_uuid() WHERE NOT EXISTS (SELECT 1 FROM global_pricing);

-- Custom activity types (e.g. SIM Change, Site Visit, Warranty Extension)
CREATE TABLE IF NOT EXISTS pricing_activity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_built_in BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO pricing_activity_types (name, charge, is_built_in, sort_order) VALUES
  ('SIM Change', 0, true, 1),
  ('Site Visit', 0, true, 2),
  ('Warranty Extension', 0, true, 3)
ON CONFLICT DO NOTHING;
