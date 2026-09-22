-- Add driver-behavior and vehicle-groups permissions for all client roles
-- driver-behavior: owner/super_admin get view+edit, admin gets view+edit, user gets view
UPDATE role_portal_permissions
SET permissions = jsonb_set(
  jsonb_set(permissions, '{driver-behavior}', '["view","edit"]'::jsonb, true),
  '{vehicle-groups}', '["view","edit"]'::jsonb, true
)
WHERE role IN ('client_owner', 'client_super_admin');

UPDATE role_portal_permissions
SET permissions = jsonb_set(
  jsonb_set(permissions, '{driver-behavior}', '["view","edit"]'::jsonb, true),
  '{vehicle-groups}', '["view","edit"]'::jsonb, true
)
WHERE role = 'client_admin';

UPDATE role_portal_permissions
SET permissions = jsonb_set(
  jsonb_set(permissions, '{driver-behavior}', '["view"]'::jsonb, true),
  '{vehicle-groups}', '["view"]'::jsonb, true
)
WHERE role = 'client_user';
