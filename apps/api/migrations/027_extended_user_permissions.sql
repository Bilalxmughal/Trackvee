ALTER TABLE org_user_permissions
  ADD COLUMN IF NOT EXISTS driver_behavior_view BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS driver_behavior_edit BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reports_view BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS users_view BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS users_add BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS users_edit BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS users_delete BOOLEAN DEFAULT NULL;

UPDATE role_portal_permissions
SET permissions = jsonb_set(permissions, '{reports}', '["view"]'::jsonb, true)
WHERE role IN ('client_owner', 'client_super_admin', 'client_admin', 'client_user')
  AND NOT (permissions ? 'reports');
