ALTER TABLE org_user_permissions
  ADD COLUMN IF NOT EXISTS dashboard_view boolean NULL,
  ADD COLUMN IF NOT EXISTS map_view boolean NULL;
