CREATE TABLE IF NOT EXISTS audit_logs (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  user_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
  user_email   VARCHAR(255),
  user_name    VARCHAR(255),
  user_role    VARCHAR(50),
  org_id       UUID         REFERENCES organizations(id) ON DELETE SET NULL,
  org_name     VARCHAR(255),
  action       VARCHAR(30)  NOT NULL,
  entity_type  VARCHAR(50)  NOT NULL,
  entity_id    VARCHAR(255),
  entity_name  VARCHAR(255),
  details      JSONB,
  ip           VARCHAR(45),
  status       VARCHAR(20)  NOT NULL DEFAULT 'success'
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp  ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id     ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity     ON audit_logs(entity_type);
