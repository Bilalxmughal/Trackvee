CREATE TABLE IF NOT EXISTS saved_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        VARCHAR(255) NOT NULL,
  type         VARCHAR(50)  NOT NULL,
  params       JSONB        NOT NULL DEFAULT '{}',
  org_id       UUID,
  user_id      UUID,
  user_name    VARCHAR(255),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_org_id   ON saved_reports(org_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_user_id  ON saved_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_reports_created  ON saved_reports(created_at DESC);
