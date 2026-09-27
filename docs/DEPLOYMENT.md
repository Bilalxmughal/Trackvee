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

## Nginx

Reload Nginx only when its configuration or static routing changed:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Verification

After backend deploy, verify `pm2 list` shows `yotrack-api` and `yotrack-gateway` online. A successful frontend build verifies compilation but does not prove Vercel promoted that commit to production.
