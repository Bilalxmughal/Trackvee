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

Use `--update-env` only when environment variables changed.

## Gateway deployment on Oracle

```bash
cd ~/yotrack
git pull origin main
pnpm --filter gateway build
pm2 restart yotrack-gateway
```

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

The mobile dynamic sound module needs one signed EAS build after it is first added. Once that version is installed, adding or deactivating uploaded catalogue sounds is server-side and does not require another app build. Use device QA for Android and iOS push playback.

## Nginx

Reload Nginx only when its configuration or static routing changed:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Verification

After backend deploy, verify `pm2 list` shows `yotrack-api` and `yotrack-gateway` online. A successful frontend build verifies compilation but does not prove Vercel promoted that commit to production.
