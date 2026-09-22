-- Rename org role enum values to client role names
-- PostgreSQL does not support ALTER TYPE ... RENAME VALUE directly before 10,
-- so we use the supported approach: rename existing values one by one.

ALTER TYPE users_role_enum RENAME VALUE 'org_owner'  TO 'client_owner';
ALTER TYPE users_role_enum RENAME VALUE 'org_admin'  TO 'client_super_admin';
ALTER TYPE users_role_enum RENAME VALUE 'org_user'   TO 'client_admin';
ALTER TYPE users_role_enum RENAME VALUE 'customer'   TO 'client_user';

-- Update default value on users.role column
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'client_user';

-- Rename role_portal_permissions rows to new role names
UPDATE role_portal_permissions SET role = 'client_owner'       WHERE role = 'org_owner';
UPDATE role_portal_permissions SET role = 'client_super_admin' WHERE role = 'org_admin';
UPDATE role_portal_permissions SET role = 'client_admin'       WHERE role = 'org_user';
UPDATE role_portal_permissions SET role = 'client_user'        WHERE role = 'customer';

-- Insert new rows if they don't exist yet (idempotent)
INSERT INTO role_portal_permissions (role, permissions) VALUES
  ('client_owner',       '{"dashboard":["view"],"map":["view"],"vehicles":["view","add","edit","delete"],"alerts":["view","add","edit","delete"],"geofences":["view","add","edit","delete"],"pois":["view","add","edit","delete"],"users":["view","add","edit","delete"]}'),
  ('client_super_admin', '{"dashboard":["view"],"map":["view"],"vehicles":["view","add","edit","delete"],"alerts":["view","add","edit","delete"],"geofences":["view","add","edit","delete"],"pois":["view","add","edit","delete"],"users":["view","add","edit"]}'),
  ('client_admin',       '{"dashboard":["view"],"map":["view"],"vehicles":["view"],"alerts":["view"],"geofences":["view"],"pois":["view"]}'),
  ('client_user',        '{"dashboard":["view"],"map":["view"],"vehicles":["view"],"alerts":["view"]}')
ON CONFLICT (role) DO NOTHING;
