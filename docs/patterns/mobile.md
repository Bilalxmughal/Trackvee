# Trackvee Mobile — Design 2

## Status and baseline

- Approved design name: **Trackvee Mobile Design 2 / Precision Map UI**.
- Technical baseline: React Native + TypeScript + Expo SDK 57.
- Workspace: `apps/mobile`, Expo SDK `57.0.25`, React Native `0.86.3`, React `19.2.3`.
- First native slice: client-role login with SecureStore and refresh, permission-aware Map/Vehicles/Alerts/Reports/More tabs, live tenant fleet map using OpenStreetMap tiles, vehicle list/detail, and report generation with report type, period, search, vehicle groups, select all/deselect all, and server preview.
- Keep live-fleet polling non-overlapping; skip scheduled refreshes while one is pending and ignore superseded responses so stale data cannot replace a newer position. Preserve the last good fleet state when a poll fails.
- Native app is not deployed by Vercel or PM2. Use Expo Go for development; use EAS for signed distribution builds. `apps/mobile/eas.json` defines an internally distributed Android APK preview and an Android App Bundle production profile. Link the Expo-owned project before building; let EAS manage Android app signing and configure FCM v1 credentials for remote Android pushes. iOS builds require Apple Developer and APNs credentials.
- Implemented: client-only authentication and session restoration; permission-aware Map/Vehicles/Alerts/Reports/More tabs; live fleet map and vehicle list/detail; vehicle-scoped alert CRUD; separate History and Replay routes; grouped vehicle selection and report preview.
- Implemented: permission-gated Geofence and POI management from More; circles and polygons are drawn on a native map, geofences support editable color/radius/triggers, and POIs support map placement, radius, group, description, and shared icon search. API reads and CRUD enforce authenticated organization scope and View/Add/Edit/Delete permissions.
- Implemented: Driver Behavior in More, guarded by `driver-behavior` role permissions; compact 30-day average fleet-score line chart above the leaderboard, per-vehicle score history/events, and editable organization thresholds/deductions when `edit` is granted. API scopes client trend/leaderboard/detail data to the authenticated organization and custom vehicle access; score deletion remains internal-admin-only.
- Implemented: opt-in mobile push registration on the Alerts screen, per-rule mobile-push and sound switches, five per-rule bundled tones (`trackvee`, `chime`, `pulse`, `bell`, `soft`), foreground notifications, authenticated alert-event deep links, and an event detail route. API delivery targets only active same-organization users with effective `alerts.view` and access to the triggering vehicle. Token ownership is derived from the authenticated account; alert-event detail rechecks organization and vehicle scope. Custom tone support requires migration 025 and a new EAS binary; the API preserves the legacy channel for older app registrations.
- Implemented: fleet-wide alert-rule list/create/edit/delete in Alerts with a three-step wizard, searchable grouped vehicle selection, optional organization-wide targeting, alert configuration, schedules, and mobile push preferences. Organization-wide creation/editing is exposed only when the caller's full-fleet scope is confirmed; API list responses redact inaccessible targets and disable mutations when the caller cannot manage the complete target scope. Optional group/geofence/device lookups fail independently so missing auxiliary permissions do not hide alert rules.
- New mobile-created alert rules default `notifications.appPush` to enabled in both fleet and vehicle-specific forms; editing preserves an explicit saved `false` but treats a missing legacy value as enabled. The Alerts screen restores its registered push state from SecureStore before retrying registration, and shows a checking state while OS permission is checked. Keep the mobile-notifications row flat without an outer border, form content scrollable, and the save action keyboard-safe on both platforms.
- In the alert-type step, show any numeric trigger value before the long type selector, with a clear label and helper, so users notice and understand the threshold. Seed the actual config with the same default shown in the input whenever the selected type changes. In Settings, keep the Mobile Push option visually flat without a surrounding card border.
- Fleet alert creation/edit uses the root Expo Router stack route `/alert-rule`, not a native full-screen Modal, so system status-bar safe areas and native back gestures work like other pages. Keep the step header below the top inset and the sticky primary action clear of the home indicator; returning after save refreshes Alerts on focus.
- After successful sign-in, dismiss the public onboarding/login history before replacing with `/map`; a hardware or swipe back from the authenticated app must never reveal Get Started.
- Still pending: Apply migration `025_mobile_push_sound_support.sql` in production before the API deploy; create a new EAS binary to bundle the four new WAV tones; Android signing/FCM credentials, signed native build and device delivery QA; iOS additionally needs Apple Developer/APNs credentials. Notification preferences and background refresh; report custom date/time and conditional filters, grouping and exports; device health and maintenance workflows. Migration `024_mobile_push_tokens.sql` is already applied in production. See `docs/FEATURE_MATRIX.md` for the concise parity list.
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
- Add/create action is a standalone red plus icon without a filled box. Map zoom controls are paired boxed controls with matching dimensions; keep the plus glyph red.
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
- Geofence and POI management routes are permission-gated from More and use the same `geofences`/`pois` role keys as the portal. API authorization must derive client organization from the authenticated user and enforce per-user CRUD overrides on every request; never trust client-supplied `orgId`, `id`, or ownership fields.
- Driver Behavior leaderboard, detail, trend and settings.
- Reports with portal-equivalent filters and exports supported by mobile.
- Users, vehicle access and custom permissions for authorized roles.
- Profile, notification preferences, map preferences, security and support.

## Mobile-specific product requirements

- Push notifications with deep links to the relevant vehicle/event and five bundled WAV tones. Android resource filenames must use lowercase letters, digits, or underscores (no hyphens). Keep plugin filenames, Android channel sounds, and API allowlist mappings identical. Android channels are immutable after creation; use a new channel ID when changing sound behavior. Register `supportsCustomSounds` only after all tone and silent channels are provisioned; older registrations keep the legacy channel. Do not prompt at app launch; request permission from Alerts. Register Expo tokens only for authenticated client users with effective `alerts.view`. Include the event log ID in notification data and revalidate tenant and vehicle access on detail fetch. Send push only for rules with `notifications.appPush === true`; default legacy `appSound` to enabled and `appSoundId` to `trackvee`, and send silent pushes only through the provisioned silent channel.
- Foreground/background refresh behavior that respects battery usage.
- Clear loading, empty, offline, stale-data and retry states.
- Use the admin vehicle icon with heading rotation, animate between received fixes, and cluster nearby vehicles when zoomed out. Keep the main map top controls unchanged when adjusting map behavior.
- Vehicle detail opens directly on map-marker tap and uses a map plus docked telemetry sheet. Information grid dividers stop short of horizontal rules and have no outside vertical edge. Coordinates open Google Maps; Follow only recenters/follows. Show stop duration only from the fresh stationary stats result; refresh it from the shared stats endpoint. Odometer uses rounded, comma-separated kilometres. Keep Engine Cut/Restore in the header action position and preserve its confirmation flow.
- Vehicle detail cards stay compact and non-scrollable; coordinates open Google Maps while Follow only recenters and the Follow action uses the theme color while active. Replay and History carry the selected IMEI and expose PKT date/time pickers with 12-hour AM/PM controls. Keep vehicle search out of these route screens; show Today/Yesterday/Last Week on one flat row and From/To plus Load together on a second flat row, all within screen width without horizontal scrolling.
- History groups samples into Start/Driving/Idle/Parked/End events with PKT times and durations. Clicking an event selects it and highlights the driving path green; Driving markers are green and Parked markers use Trackvee red. Stop details show From/To time and address plus duration, and size to their content. Replay has media-style previous/play/next controls, a wider speed dropdown with a spaced and vertically centered chevron, a slightly taller control panel, and a scrubber that retains touch ownership to avoid edge-back navigation. Show current speed beside the replay car; direction arrows have transparent backgrounds. History event rows have enough height for comfortable selection.
- Live-map zoom reads native visible map bounds and changes region deltas, so it works with both iOS and Android map providers during and after fleet fitting. Dock fleet status summaries in one row, vertically center each metric between short inset separators, and leave top breathing room near bottom navigation.
- History selection popups show one start/location address, then From/To times, stop duration when applicable, and speed/ignition. A Driving segment implies ignition On in the display even when the segment's first raw sample reports ignition Off. Resolve a single event address; do not reverse-geocode both segment endpoints for this card.
- History date/time fields represent `Asia/Karachi` wall time and are converted to UTC ISO values for the API. Vehicle-specific alert list/create/edit/delete use `/alerts/vehicle/:imei` and `/alerts/:id/vehicle/:imei`; never fall back to fleet-wide CRUD from vehicle detail.
- Keep Vehicles directly after Map in bottom navigation. The Vehicles tab requires `vehicles.view`, while a vehicle detail opened from the live map requires `map.view`; both wait for permissions to load before redirecting. Missing role-permission keys use defaults, but explicit denials remain effective.
- The Vehicles tab uses `/vehicle-groups` to group rows, with search and status filters. Rows show plate first, Make/Model below, a status stripe, latest speed/update and compact ignition/GPS/battery/signal data. The row menu offers Follow, Replay, Last Hour/Today/Yesterday History, alert editing and permission-gated Engine Cut/Restore. Keep preset history date ranges in PKT and preserve the selected IMEI.
- Vehicle groups can be created with `vehicles.add`, renamed/assigned with `vehicles.edit`, and deleted with `vehicles.delete`. The create/edit picker mirrors the portal: searchable, collapsible Unassigned and existing-group sections, per-vehicle checkboxes, group-level selection, Select All and Deselect All. Selecting a vehicle from another group moves it, matching the API's one-group-per-vehicle rule; when editing, preserve existing memberships outside the current user's permitted vehicle set.
- Main-map markers that navigate to detail must not set native `title`/`description`, since those open the platform callout. Keep the logo at left and search immediately before the alert button; map type and zoom/fit controls stay on the right.
- Street uses OpenStreetMap tiles; Satellite uses the device's native map provider. Configure the Android Google Maps key for signed distribution builds before relying on Satellite there.
- Secure token storage and biometric/PIN protection for sensitive commands.
- Cache only a validated client profile in SecureStore. Restore it immediately on launch and refresh it from `/auth/me`; preserve the session across network and server failures, and clear it only on explicit logout or a definitively invalid refresh token. Never relax the client-role allowlist.
- Engine Cut/Restore retains IMEI confirmation and permission checks.
- Device command authorization must check the authenticated role and selected vehicle at the API; an IMEI alone never grants command access. Vehicle alert edits/deletes split shared rules or exclude a single IMEI without changing other vehicles.
- History-point timestamps are displayed in `Asia/Karachi` (PKT). Address lookup uses native device reverse geocoding on tap; Android requests foreground location permission for this platform API. Do not use the public Nominatim endpoint for tracker-app reverse geocoding.
- Use Street/OpenStreetMap, Satellite and Hybrid on iOS; native Terrain is available only on Android with a supported map provider. Map-style changes preserve the active map view.
- Respect safe areas, platform back behavior, keyboard handling and accessibility labels.
- Do not silently broaden portal permissions on mobile.

## Data and behavior parity

- Vehicle status threshold and colors match `docs/patterns/map.md`.
- Vehicle labels and selection match `docs/patterns/ui.md`.
- Reports, alerts, geofences, POIs, behavior, users and permissions follow their domain pattern documents.
- Driver Behavior mobile/API access uses the `driver-behavior` role permission; client vehicle detail and leaderboard results must also honor organization and per-user `vehicleIds` scope. Settings payloads are field-whitelisted and score deletion remains internal-admin-only.
- UI copy is English only.
