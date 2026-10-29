# Claude Handoff: Production Verification

Use this handoff to finish the remaining production checks. The user asked for Scheduled Reports, Device Health, and Gateway CRC verification. Scheduled email delivery has since been confirmed; Device Health production access/scope and the running Gateway CRC build/logs still need verification.

## Start here

Read `AGENTS.md`, `CURRENT_STATE.md`, `KNOWN_ISSUES.md`, and `docs/DEPLOYMENT.md`. Then read the relevant domain guides:

- `docs/patterns/reports.md`
- `docs/patterns/device-health.md`
- `docs/patterns/map.md`
- `PROJECT.md` for the GT06 protocol notes

The relevant branch is `main`. The checked local and Oracle checkout were both `72982be` on 2026-10-09. Do not modify application code unless a check demonstrates a defect. Keep credentials in the server `.env`; never print or copy their values.

## 1. Scheduled Reports — delivery verified; pause/resume UI check outstanding

Production evidence supplied by the user on 2026-10-09:

- `scheduled_reports` table exists.
- `RESEND_API_KEY` and `REPORT_EMAIL_FROM` are configured (presence only was checked; values were not shown).
- One schedule exists and is active.
- One successful email delivery is recorded; zero schedules have a recorded error.
- Latest successful delivery: `2026-10-08 23:00:49 PKT`.

Do not create another schedule or change the active production schedule just to repeat the send test. If an authenticated Reports UI session is available, verify the Active/Pause control safely with a non-delivering test path or a schedule explicitly designated by the user. Do not pause or edit the customer's existing active schedule without their approval. If no safe test is available, report pause/resume as unverified; delivery itself is confirmed.

Primary code: `apps/api/src/reports/scheduled-reports.service.ts`, `apps/admin/src/pages/ReportsPage.tsx`, and `apps/portal/src/components/ReportsModal.tsx`. Migration: `apps/api/migrations/030_scheduled_report_delivery.sql`.

## 2. Device Health — production UI and tenant-scope check outstanding

Source checks already passed: `apps/api` TypeScript check succeeded. The API endpoint `GET /telemetry/device-health` requires client `vehicles.view`; `DevicesService.findAll` scopes a client by organization and optional per-user vehicle grants. Static rules are in `docs/patterns/device-health.md`.

Verify using authorized production accounts:

1. An internal admin with the Device Health page permission can load the page and see its permitted fleet.
2. A client with `vehicles.view` can load Device Health and sees only devices associated with vehicles in their organization and their own vehicle grant.
3. A client without effective `vehicles.view` is denied. No client request may choose another organization or supply an IMEI list to broaden scope.
4. Portal and mobile client UI do not display, search, or export IMEI values.

Relevant files: `apps/api/src/telemetry/telemetry.controller.ts`, `apps/api/src/telemetry/telemetry.service.ts`, `apps/api/src/devices/devices.service.ts`, `apps/admin/src/pages/DeviceHealthPage.tsx`, `apps/portal/src/components/DeviceHealthPanel.tsx`, and `apps/mobile/app/device-health.tsx`.

Use existing authenticated sessions and inspect only the minimum fields needed. Do not paste access tokens, `.env` contents, or raw IMEIs into chat. If production accounts/UI are unavailable, state that the production behavior remains unverified; do not infer it from source checks.

## 3. Gateway CRC — source fix verified; active process build and fresh logs outstanding

Evidence supplied by the user on 2026-10-09:

- Oracle `HEAD` and `origin/main` both reported `72982be`.
- CRC fix commit `33f4685` is an ancestor of that checkout.
- Both `yotrack-api` and `yotrack-gateway` showed `online` in PM2.
- Local protocol build passed and `packages/protocol/test/gt06-crc.test.mjs` passed 2/2 against captured GT06 frames.
- The PM2 output contained CRC mismatch warnings and GPS-persisted messages, but the warning lines had no timestamps. Their age is unknown, and `git fetch` alone does not rebuild the running PM2 process.

If authorized Oracle access is available, first confirm `~/yotrack` is on `72982be` or a later `main` commit. Build the gateway; restart it only if the build succeeds:

```bash
cd ~/yotrack
git rev-parse --short HEAD
git rev-parse --short origin/main
pnpm --filter gateway build
pm2 restart yotrack-gateway
pm2 list
```

This is a Gateway-only restart; no API restart or database migration is needed for the CRC change. After restart, capture fresh output while a real tracker sends normal packets (or rely on a new timestamped log stream): verify valid GPS persists and ACKs continue, and check whether CRC mismatch warnings recur. Do not count old PM2 log lines as post-restart evidence. Do not change the checksum algorithm or reject frames based only on warnings; compare any fresh mismatching frame against the captured-frame tests and preserve current non-fatal behavior until the frame is understood.

If SSH is unavailable, give the user these commands and ask them to paste the build output, PM2 status, and a fresh log sample. Never ask for private keys or credentials.

## Completion report

Report each item separately as **verified**, **partially verified**, or **blocked**, with evidence and timestamp. Keep source-level tests distinct from production verification. Do not claim Gateway CRC runtime success until fresh post-build/restart logs show the result, or Device Health production scope success until authenticated admin/client behavior has been exercised.
