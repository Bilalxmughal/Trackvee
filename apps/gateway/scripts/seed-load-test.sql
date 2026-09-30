\set ON_ERROR_STOP on

SELECT :'run_id' ~ '^[a-z0-9]{3,20}$' AS valid_run_id \gset
\if :valid_run_id
\else
  \echo 'run_id must contain 3-20 lowercase letters or digits'
  \quit 2
\endif

SELECT :device_count::int BETWEEN 1 AND 300 AS valid_count \gset
\if :valid_count
\else
  \echo 'device_count must be from 1 to 300'
  \quit 2
\endif

SELECT :'imei_prefix' ~ '^[0-9]{10}$' AND NOT EXISTS (
  SELECT 1 FROM devices WHERE imei LIKE :'imei_prefix' || '%'
) AND NOT EXISTS (
  SELECT 1 FROM telemetry WHERE imei LIKE :'imei_prefix' || '%'
) AS safe_prefix \gset
\if :safe_prefix
\else
  \echo 'IMEI prefix is invalid or already present in devices/telemetry; choose an unused test-only 10-digit prefix'
  \quit 2
\endif

SELECT EXISTS (SELECT 1 FROM users WHERE role = 'super_admin') AS has_owner \gset
\if :has_owner
\else
  \echo 'No super_admin user exists to own the isolated test organization'
  \quit 2
\endif

SELECT NOT EXISTS (SELECT 1 FROM organizations WHERE slug = 'loadtest-' || :'run_id') AS unused_run \gset
\if :unused_run
\else
  \echo 'This LOADTEST run_id already exists; use a new run_id or clean up that exact run first'
  \quit 2
\endif

BEGIN;
WITH params AS (
  SELECT :'run_id'::text AS run_id, :'imei_prefix'::text AS imei_prefix, :device_count::int AS device_count
), admin_owner AS (
  SELECT id::text AS id FROM users WHERE role = 'super_admin' ORDER BY created_at LIMIT 1
), new_org AS (
  INSERT INTO organizations (name, slug, owner_id, type, is_active)
  SELECT 'LOADTEST ' || p.run_id, 'loadtest-' || p.run_id, o.id, 'b2b', true
  FROM params p CROSS JOIN admin_owner o
  RETURNING id, owner_id
), new_vehicles AS (
  INSERT INTO vehicles (name, license_plate, make, model, type, owner_id, organization_id, is_active, lifecycle_status)
  SELECT 'LOADTEST ' || p.run_id || ' Vehicle ' || lpad(g.n::text, 3, '0'),
         'LT-' || upper(p.run_id) || '-' || lpad(g.n::text, 3, '0'),
         'Load Test', 'GT06 Simulator', 'car', o.owner_id, o.id, true, 'active'
  FROM new_org o CROSS JOIN params p CROSS JOIN LATERAL generate_series(1, p.device_count) AS g(n)
  RETURNING id, organization_id, license_plate
), indexed_vehicles AS (
  SELECT id, organization_id, license_plate, row_number() OVER (ORDER BY license_plate) AS n
  FROM new_vehicles
), new_devices AS (
  INSERT INTO devices (imei, name, status, inventory_status, vehicle_id)
  SELECT p.imei_prefix || lpad(v.n::text, 5, '0'),
         'LOADTEST ' || p.run_id || ' Device ' || lpad(v.n::text, 3, '0'),
         'offline', 'assigned', v.id
  FROM indexed_vehicles v CROSS JOIN params p
  RETURNING id, vehicle_id
)
INSERT INTO device_assignments (device_id, vehicle_id, organization_id, assigned_at, action, reason)
SELECT d.id, d.vehicle_id, v.organization_id, NOW(), 'load_test', 'Synthetic GT06 load test'
FROM new_devices d JOIN indexed_vehicles v ON v.id = d.vehicle_id;

COMMIT;
SELECT 'LOADTEST-' || upper(:'run_id') AS test_organization,
       :device_count::int AS vehicles_and_devices,
       :'imei_prefix' || '00001...' AS synthetic_imei_range;
