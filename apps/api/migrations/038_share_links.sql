-- Share Links: DB-backed live location sharing
CREATE TABLE IF NOT EXISTS share_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token       VARCHAR(20) NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  imei        VARCHAR(20) NOT NULL,
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at  TIMESTAMPTZ,
  view_count  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_org_id ON share_links(org_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token  ON share_links(token);
