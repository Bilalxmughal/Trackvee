# Deployment

## Source and branch

- Git branch: `main`
- Oracle repository: `/home/ubuntu/yotrack` (`~/yotrack`)
- Do not use `/var/www/yutrack` or `/home/ubuntu/YuTrack`.

## Frontends

Admin and portal are Vite applications deployed from `main` through their configured Vercel projects.

- Admin root: `apps/admin`
- Portal root: `apps/portal`

Local verification:

```bash
pnpm --filter admin build
pnpm --filter portal build
```

Frontend-only changes do not require PM2 restart. There is no PM2 process named `portal`.

The native app at `apps/mobile` runs through Expo and is not deployed by Vercel or PM2. Local development: `pnpm --filter @yotrack/mobile start`. EAS profiles are in `apps/mobile/eas.json`: `preview` creates an internally distributed Android APK for device testing, and `production` creates an Android App Bundle. Link the Expo-owned project with `npx eas-cli@latest init` from `apps/mobile`, then use `npx eas-cli@latest build --profile preview --platform android` for a device test. EAS-managed Android app-signing credentials can be generated at the first build; configure the Firebase FCM v1 service-account key in the linked Expo project's credentials for remote Android push delivery. iOS builds additionally require Apple Developer credentials and APNs push credentials. Never commit signing keys or service-account files. Bundled Android notification sound resources must use valid lowercase resource names such as `trackvee_alert.wav`.

## API deployment on Oracle

```bash
cd ~/yotrack
git pull origin main
pnpm --filter api build
pm2 restart yotrack-api
```

Scheduled report delivery requires migration `030_scheduled_report_delivery.sql` and Resend email credentials. Set these in `/home/ubuntu/yotrack/.env` without committing them:

```dotenv
RESEND_API_KEY=<Resend API key>
REPORT_EMAIL_FROM=<verified sender address>
```

Apply the migration before deploying the API. Once the sender/domain is verified in Resend and both environment variables are present, build and restart the API. Schedules run daily at the selected Pakistan time; custom report windows must end before delivery, the schedule owner always receives a copy, and up to 10 additional recipient addresses may be configured.

```bash
cd ~/yotrack
set -a
. ./.env
set +a
: "${DATABASE_URL:?DATABASE_URL is not set in .env}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/030_scheduled_report_delivery.sql
pnpm --filter api build
pm2 restart yotrack-api --update-env
```

Use `--update-env` only when environment variables changed.

Vehicle-owned device assignment and device-removal expiry require migration `032_vehicle_device_lifecycle_reason.sql`. Apply it after 031 and before deploying the API; without it, API queries that load vehicle lifecycle details will fail:

```bash
cd ~/yotrack
set -a
. ./.env
set +a
: "${DATABASE_URL:?DATABASE_URL is not set in .env}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/032_vehicle_device_lifecycle_reason.sql
pnpm --filter api build
pm2 restart yotrack-api
```

## Gateway deployment on Oracle

```bash
cd ~/yotrack
git pull origin main
pnpm --filter gateway build
pm2 restart yotrack-gateway
```

For a controlled synthetic live-tracking capacity check, follow [`LOAD_TESTING.md`](LOAD_TESTING.md). It seeds a separate `LOADTEST` organization, simulates up to 300 GT06 devices through localhost port 5023, and includes a bounded cleanup procedure. Do not run load against customer records or a public gateway address.

## Database migrations

Schema changes require a numbered SQL migration in `apps/api/migrations/`. Apply the exact new migration before restarting code that depends on it. Never enable TypeORM synchronization.

The shared notification sound catalogue requires migration `026_notification_sound_library.sql`; migration 025 must already be applied because it adds the base push-sound capability fields. Apply 026 on Oracle before deploying the API:

```bash
cd ~/yotrack
set -a
. ./.env
set +a
: "${DATABASE_URL:?DATABASE_URL is not set in .env}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/026_notification_sound_library.sql
pnpm --filter api build
pm2 restart yotrack-api
```

Maintenance service history and role grants require migration `029_maintenance_records.sql`. Apply it on Oracle before deploying the maintenance API:

```bash
cd ~/yotrack
set -a
. ./.env
set +a
: "${DATABASE_URL:?DATABASE_URL is not set in .env}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/029_maintenance_records.sql
pnpm --filter api build
pm2 restart yotrack-api
```

Device assignment history and vehicle lifecycle require migration `031_device_assignment_and_vehicle_lifecycle.sql`. Apply it before building/restarting the API so TypeORM can read the new columns and report generation can resolve telemetry against assignment periods:

```bash
cd ~/yotrack
set -a
. ./.env
set +a
: "${DATABASE_URL:?DATABASE_URL is not set in .env}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/031_device_assignment_and_vehicle_lifecycle.sql
pnpm --filter api build
pm2 restart yotrack-api
```

The migration backfills each current device link from the earliest retained telemetry point (or device creation time when no telemetry exists); those legacy dates are estimates. New assignment/transfer/replacement records have operational timestamps and attribution metadata.

Per-user Dashboard and Live Map permission overrides require migration `033_core_user_permissions.sql`. Apply after migrations 031 and 032 and before deploying the API:

```bash
cd ~/yotrack
set -a
. ./.env
set +a
: "${DATABASE_URL:?DATABASE_URL is not set in .env}"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/api/migrations/033_core_user_permissions.sql
pnpm --filter api build
pm2 restart yotrack-api
```

The mobile dynamic sound module needs one signed EAS build after it is first added. Once that version is installed, adding or deactivating uploaded catalogue sounds is server-side and does not require another app build. Use device QA for Android and iOS push playback.

## Nginx

Reload Nginx only when its configuration or static routing changed:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Verification

After backend deploy, verify `pm2 list` shows `yotrack-api` and `yotrack-gateway` online. A successful frontend build verifies compilation but does not prove Vercel promoted that commit to production.
