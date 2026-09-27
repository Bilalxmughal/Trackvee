# Trackvee Mobile

Expo SDK 57 app, using the existing YoTrack API and the approved Precision Map UI direction.

## Run with Expo Go

From the repository root:

```bash
pnpm --filter @yotrack/mobile start
```

Install the matching Expo Go release on the phone and scan the development QR code. Keep the phone and development computer on the same network. The default API base uses the HTTPS client portal route; set `EXPO_PUBLIC_API_URL` only when testing another API environment.

## Checks

```bash
pnpm --filter @yotrack/mobile typecheck
pnpm --filter @yotrack/mobile build
```

The build command exports an Android JavaScript bundle. It does not create a signed installable APK/AAB; store distribution will use EAS Build after release credentials and configuration are provided.
