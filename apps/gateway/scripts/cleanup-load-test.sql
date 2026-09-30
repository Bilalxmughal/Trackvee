\set ON_ERROR_STOP on

SELECT :'run_id' ~ '^[a-z0-9]{3,20}$' AS valid_run_id \gset
\if :valid_run_id
\else
  \echo 'run_id must contain 3-20 lowercase letters or digits'
  \quit 2
\endif
SELECT :'imei_prefix' ~ '^[0-9]{10}$' AS valid_prefix \gset
\if :valid_prefix
\else
  \echo 'imei_prefix must contain exactly 10 digits'
  \quit 2
\endif
SELECT EXISTS (
  SELECT 1 FROM organizations WHERE slug = 'loadtest-' || :'run_id' AND name = 'LOADTEST ' || :'run_id'
) AS test_org_exists \gset
\if :test_org_exists
\else
  \echo 'Exact LOADTEST organization not found; no data was deleted'
  \quit 2
\endif

BEGIN;
DELETE FROM telemetry t
USING devices d, vehicles v, organizations o
WHERE (t.device_id = d.id OR t.imei = d.imei)
  AND d.vehicle_id = v.id AND v.organization_id = o.id
  AND o.slug = 'loadtest-' || :'run_id' AND o.name = 'LOADTEST ' || :'run_id'
  AND d.imei LIKE :'imei_prefix' || '%';

DELETE FROM driver_events e
USING vehicles v, organizations o
WHERE e.vehicle_id = v.id AND v.organization_id = o.id
  AND o.slug = 'loadtest-' || :'run_id' AND o.name = 'LOADTEST ' || :'run_id';
DELETE FROM driver_scores s
USING vehicles v, organizations o
WHERE s.vehicle_id = v.id AND v.organization_id = o.id
  AND o.slug = 'loadtest-' || :'run_id' AND o.name = 'LOADTEST ' || :'run_id';
DELETE FROM driver_behavior_settings WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'loadtest-' || :'run_id' AND name = 'LOADTEST ' || :'run_id');
DELETE FROM device_assignments a
USING devices d, vehicles v, organizations o
WHERE a.device_id = d.id AND d.vehicle_id = v.id AND v.organization_id = o.id
  AND o.slug = 'loadtest-' || :'run_id' AND o.name = 'LOADTEST ' || :'run_id'
  AND d.imei LIKE :'imei_prefix' || '%';
DELETE FROM devices d
USING vehicles v, organizations o
WHERE d.vehicle_id = v.id AND v.organization_id = o.id
  AND o.slug = 'loadtest-' || :'run_id' AND o.name = 'LOADTEST ' || :'run_id'
  AND d.imei LIKE :'imei_prefix' || '%';
DELETE FROM vehicles WHERE organization_id = (SELECT id FROM organizations WHERE slug = 'loadtest-' || :'run_id' AND name = 'LOADTEST ' || :'run_id')
  AND license_plate LIKE 'LT-' || upper(:'run_id') || '-%';
DELETE FROM organizations WHERE slug = 'loadtest-' || :'run_id' AND name = 'LOADTEST ' || :'run_id';
COMMIT;
\echo 'Exact LOADTEST organization, vehicles, assigned devices, assignments, telemetry, and generated behavior data removed.'
