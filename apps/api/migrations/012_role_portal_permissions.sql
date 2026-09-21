CREATE TABLE IF NOT EXISTS role_portal_permissions (
  role        VARCHAR(30) PRIMARY KEY,
  permissions JSONB NOT NULL DEFAULT '{}'
);

INSERT INTO role_portal_permissions (role, permissions) VALUES
  ('org_owner', '{"dashboard":["view"],"map":["view"],"vehicles":["view","add","edit","delete"],"alerts":["view","add","edit","delete"],"geofences":["view","add","edit","delete"],"pois":["view","add","edit","delete"],"users":["view","add","edit","delete"]}'),
  ('org_admin',  '{"dashboard":["view"],"map":["view"],"vehicles":["view","add","edit","delete"],"alerts":["view","add","edit","delete"],"geofences":["view","add","edit","delete"],"pois":["view","add","edit","delete"],"users":["view","add","edit"]}'),
  ('org_user',   '{"dashboard":["view"],"map":["view"],"vehicles":["view"],"alerts":["view"],"geofences":["view"],"pois":["view"]}'),
  ('customer',   '{"dashboard":["view"],"map":["view"],"vehicles":["view"],"alerts":["view"]}')
ON CONFLICT (role) DO NOTHING;
