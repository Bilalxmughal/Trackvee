# Trackvee Mobile — Design 2

## Status and baseline

- Approved design name: **Trackvee Mobile Design 2 / Precision Map UI**.
- Technical baseline: React Native + TypeScript + Expo SDK 57.
- Workspace: `apps/mobile`, Expo SDK `57.0.25`, React Native `0.86.3`, React `19.2.3`.
- First native slice: client-role login with SecureStore and refresh, permission-aware Map/Vehicles/Alerts/Reports/More tabs, live tenant fleet map using OpenStreetMap tiles, vehicle list/detail, and report generation with report type, period, search, vehicle groups, select all/deselect all, and server preview.
- Native app is not deployed by Vercel or PM2. Use Expo Go for development; use EAS for signed distribution builds.
- Remaining parity work: trip history/replay, editable alerts/geofences/POIs, behavior leaderboard/settings, custom user permissions, notification delivery/preferences, and complete report exports/date filters.
- Reuse the existing NestJS API, refresh-token flow, client roles, tenant isolation, and portal permission keys.
- Mobile is a client-facing product; internal admin users must not authenticate into it.
- Keep the login back control pinned in the top safe area, and distinguish network/server failures from invalid credentials without revealing which portal a rejected account belongs to.
- All tab headers must sit below the iOS status bar; map overlays apply safe-area insets exactly once, and the bottom tab bar height/padding must include the device bottom inset so labels stay visible. Keep map zoom-in as a standalone red plus and use modest 9–10px control corners.

## Visual direction

- Map-first Clean Light interface with Trackvee red `#dc2626` used selectively.
- Warm white/white surfaces, black primary text, gray secondary text, thin `#e5e7eb` separators.
- Inter, SF Pro, or the closest platform-native professional sans-serif.
- Compact hierarchy and tabular numbers for telemetry.
- Buttons have a modest corner radius (approximately 6–8px), not capsules.
- Add/create action is a standalone red plus icon without a filled box.
- Flat lists and docked bottom panels; avoid floating decorative cards.
- No pills, pill badges, gradients, glassmorphism, emoji, oversized headings, or generic AI dashboard visuals.
- Status colors are reserved for real operational meaning.

## Primary flow

1. Get Started.
2. Login.
3. Full-screen Live Map after authentication.
4. Bottom navigation: Map, Vehicles, Alerts/Notifications, Reports, More.

The exact visible navigation items are permission-controlled. Map remains the primary surface wherever practical.

## Core screens

- Live Fleet Map with plate labels, vehicle state, search, map style and zoom controls.
- Vehicles list grouped by fleet, plate first and Make/Model second.
- Vehicle detail with telemetry and Follow, Replay, History, Alert, and protected Engine Cut actions.
- History map and timeline with route, arrows, P/I/STOP/start/end markers.
- Trip Replay with docked playback controls and live telemetry line.
- Notifications and Alert Rules.
- Circle/polygon Geofence drawing on the map.
- POI creation with shared icon set.
- Driver Behavior leaderboard, detail, trend and settings.
- Reports with portal-equivalent filters and exports supported by mobile.
- Users, vehicle access and custom permissions for authorized roles.
- Profile, notification preferences, map preferences, security and support.

## Mobile-specific product requirements

- Push notifications with deep links to the relevant vehicle/event.
- Foreground/background refresh behavior that respects battery usage.
- Clear loading, empty, offline, stale-data and retry states.
- Secure token storage and biometric/PIN protection for sensitive commands.
- Engine Cut/Restore retains IMEI confirmation and permission checks.
- Respect safe areas, platform back behavior, keyboard handling and accessibility labels.
- Do not silently broaden portal permissions on mobile.

## Data and behavior parity

- Vehicle status threshold and colors match `docs/patterns/map.md`.
- Vehicle labels and selection match `docs/patterns/ui.md`.
- Reports, alerts, geofences, POIs, behavior, users and permissions follow their domain pattern documents.
- UI copy is English only.
