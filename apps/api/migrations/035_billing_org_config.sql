-- Per-org billing configuration (overrides global pricing)

CREATE TABLE IF NOT EXISTS org_billing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
  -- NULL = inherit from global_pricing
  device_price NUMERIC(12,2) NULL,
  installation_charge NUMERIC(12,2) NULL,
  removal_charge NUMERIC(12,2) NULL,
  transfer_charge NUMERIC(12,2) NULL,
  reactivation_charge NUMERIC(12,2) NULL,
  monthly_fixed_charge NUMERIC(12,2) NULL,
  tax_percent NUMERIC(5,2) NULL,
  threshold_enabled BOOLEAN NULL,
  threshold_days INTEGER NULL,
  activity_overrides JSONB NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_billing_config_org ON org_billing_config(org_id);
