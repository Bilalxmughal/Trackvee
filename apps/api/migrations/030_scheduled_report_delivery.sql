CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  report_type VARCHAR(40) NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipient_emails TEXT[] NOT NULL DEFAULT '{}',
  period_key VARCHAR(24) NOT NULL,
  time_pkt VARCHAR(5) NOT NULL,
  report_from_time VARCHAR(5),
  report_to_time VARCHAR(5),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_attempt_at TIMESTAMPTZ,
  last_sent_at TIMESTAMPTZ,
  last_error VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_scheduled_reports_period CHECK (period_key IN ('daily_window', 'yesterday', 'last_24_hours', 'last_7_days', 'this_month')),
  CONSTRAINT ck_scheduled_reports_time CHECK (time_pkt ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE INDEX IF NOT EXISTS ix_scheduled_reports_due
  ON scheduled_reports (next_run_at)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS ix_scheduled_reports_owner
  ON scheduled_reports (user_id, org_id, created_at DESC);
