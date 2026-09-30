# Controlled GT06 Live Load Test

This is an internal operations tool. It creates real telemetry writes in PostgreSQL through the production GT06 gateway/API path. Run only against an isolated `LOADTEST` organization, during a quiet window, while monitoring the VM and database. It is not a synthetic test against customer records.

## Test flow

1. Pull `main` on Oracle and confirm migrations 031 and 032 are present in the database.
2. Create exactly 10, 50, 100, or 300 synthetic vehicles and assigned devices under a uniquely named `LOADTEST` organization. Use an unused 10-digit IMEI prefix reserved for load testing.
3. Run the simulator locally on the Oracle VM; it connects only to `127.0.0.1:5023`, opens one TCP session per synthetic device, sends GT06 login and ignition heartbeat packets, then valid GPS packets.
4. Start with 10 devices at 30-second GPS intervals for two minutes. If healthy, stop and repeat with 50, 100, then 300 devices. Keep the 300-device stage at 30 seconds first. A later 5-second stage means about 60 GPS writes/second and should only run after reviewing earlier stages.
5. Verify simulator ACK/failure counts, persisted packet totals, telemetry receive lag, PM2 CPU/memory/restarts, PostgreSQL active connections, and the admin live map. The modes are distributed as 40% moving, 30% idle (ignition on), and 30% parked (ignition off).
6. Stop all simulator processes and run the exact-run cleanup SQL. Confirm no `LOADTEST` organization, devices, vehicles, assignments, telemetry, or driver-behavior rows remain.

The simulator caps a run at 300 devices and 15 minutes, requires at least a five-second GPS interval, and refuses non-loopback hosts. `--dry-run` prints the planned traffic without opening sockets.

## Seed a test fleet

Run these commands on Oracle from `~/yotrack`. The script requires an unused prefix. The suggested `9999900000` prefix is checked against the existing device inventory before any rows are inserted. Keep the generated test identifiers reserved until cleanup is complete.

```bash
cd ~/yotrack
git pull origin main
pnpm --filter protocol build
node apps/gateway/scripts/gt06-load-test.mjs --self-test
set -a
. ./.env
set +a
: "${DATABASE_URL:?DATABASE_URL is not set in .env}"
psql "$DATABASE_URL" -v run_id=sep30a -v device_count=300 -v imei_prefix=9999900000 -v ON_ERROR_STOP=1 -f apps/gateway/scripts/seed-load-test.sql
```

The run ID must be 3–20 lowercase letters/digits and must be unique. To stage progressively, seed 300 once and run the simulator with 10, 50, 100 and 300 active sessions; seeded vehicles outside the current stage will simply remain offline.

## Run staged simulator tests

```bash
cd ~/yotrack
node apps/gateway/scripts/gt06-load-test.mjs --devices 10 --interval-sec 30 --duration-sec 120 --imei-prefix 9999900000
node apps/gateway/scripts/gt06-load-test.mjs --devices 50 --interval-sec 30 --duration-sec 120 --imei-prefix 9999900000
node apps/gateway/scripts/gt06-load-test.mjs --devices 100 --interval-sec 30 --duration-sec 120 --imei-prefix 9999900000
node apps/gateway/scripts/gt06-load-test.mjs --devices 300 --interval-sec 30 --duration-sec 120 --imei-prefix 9999900000
```

Each run opens at most 300 simultaneous TCP sessions. Stop immediately with Ctrl+C if API/gateway errors rise, a PM2 process restarts, packet-save lag grows continuously, database connections approach their configured limit, or CPU/RAM pressure affects real tracking. Use `pm2 monit` in another SSH session. Do not restart a process during the test unless stopping the test first.

## Verify persisted test packets

```bash
psql "$DATABASE_URL" -v run_id=sep30a -v imei_prefix=9999900000 -v ON_ERROR_STOP=1 <<'SQL'
SELECT o.slug, COUNT(DISTINCT v.id) AS vehicles, COUNT(DISTINCT d.id) AS devices,
       COUNT(t.id) AS telemetry_rows, MAX(t.created_at) AS last_saved_at,
       ROUND(MAX(EXTRACT(EPOCH FROM (t.created_at - t.timestamp)))::numeric, 1) AS max_tracker_to_save_seconds
FROM organizations o
LEFT JOIN vehicles v ON v.organization_id = o.id AND v.license_plate LIKE 'LT-' || upper(:'run_id') || '-%'
LEFT JOIN devices d ON d.vehicle_id = v.id AND d.imei LIKE :'imei_prefix' || '%'
LEFT JOIN telemetry t ON t.device_id = d.id OR t.imei = d.imei
WHERE o.slug = 'loadtest-' || :'run_id' AND o.name = 'LOADTEST ' || :'run_id'
GROUP BY o.slug;
SQL
```

## Remove the test fleet and telemetry

Stop the simulator first, then use the same run ID and IMEI prefix used during setup:

```bash
psql "$DATABASE_URL" -v run_id=sep30a -v imei_prefix=9999900000 -v ON_ERROR_STOP=1 -f apps/gateway/scripts/cleanup-load-test.sql
```

This cleanup is restricted to the exact generated organization, its `LT-<RUN_ID>-` vehicles, and matching synthetic IMEIs. It does not delete other organizations or tracker rows.

## Limits

This checks concurrent TCP sessions and the GT06→gateway→API→database path with controlled packets. It does not establish real tracker/cellular reporting cadence or prove full long-term production capacity. Real vehicle movement must be verified separately against tracker timestamps and DB receive timestamps. Never point the simulator at real customer devices or set its host to a public production IP.
