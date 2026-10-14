-- Invoices (charges to clients) and Payments (received from clients)

CREATE TYPE IF NOT EXISTS invoice_type_enum AS ENUM (
  'monthly_subscription', 'device_sale', 'installation', 'removal',
  'transfer', 'reactivation', 'activity', 'manual'
);

CREATE TYPE IF NOT EXISTS invoice_status_enum AS ENUM (
  'draft', 'sent', 'paid', 'overdue', 'cancelled'
);

CREATE TYPE IF NOT EXISTS payment_method_enum AS ENUM (
  'cash', 'bank_transfer', 'cheque', 'online', 'other'
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  device_id UUID NULL REFERENCES devices(id) ON DELETE SET NULL,
  vehicle_id UUID NULL REFERENCES vehicles(id) ON DELETE SET NULL,
  activity_type_id UUID NULL REFERENCES pricing_activity_types(id) ON DELETE SET NULL,
  invoice_no VARCHAR(30) NOT NULL UNIQUE,
  type invoice_type_enum NOT NULL,
  period_from DATE NULL,
  period_to DATE NULL,
  base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status invoice_status_enum NOT NULL DEFAULT 'draft',
  due_date DATE NULL,
  description TEXT NULL,
  notes TEXT NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  payment_no VARCHAR(30) NOT NULL UNIQUE,
  payment_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  method payment_method_enum NOT NULL DEFAULT 'cash',
  reference_no VARCHAR(100) NULL,
  description TEXT NULL,
  notes TEXT NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sequence helpers for numbering
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS payment_seq START 1;

CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_device ON invoices(device_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id, payment_date DESC);
