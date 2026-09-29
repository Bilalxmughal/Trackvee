# Trackvee Mobile — Design 2

## Status and baseline

- Approved design name: **Trackvee Mobile Design 2 / Precision Map UI**.
- Technical baseline: React Native + TypeScript + Expo SDK 57.
- Workspace: `apps/mobile`, Expo SDK `57.0.25`, React Native `0.86.3`, React `19.2.3`.
- Native client app: client-role login with SecureStore and refresh, permission-aware Map/Vehicles/Alerts/Reports/More tabs, live tenant fleet map using OpenStreetMap tiles, vehicle list/detail, and Reports parity with all 13 server report types, searchable grouped vehicle selection, period presets, PKT custom date/time, conditional filters, Group By, searchable previews, saved filters and shareable CSV files.
- Keep live-fleet polling non-overlapping; skip scheduled refreshes while one is pending and ignore superseded responses so stale data cannot replace a newer position. Preserve the last good fleet state when a poll fails.
- Native app is not deployed by Vercel or PM2. Use Expo Go for development; use EAS for signed distribution builds. `apps/mobile/eas.json` defines an internally distributed Android APK preview and an Android App Bundle production profile. Link the Expo-owned project before building; let EAS manage Android app signing and configure FCM v1 credentials for remote Android pushes. iOS builds require Apple Developer and APNs credentials.
- Implemented: client-only authentication and session restoration; permission-aware Map/Vehicles/Alerts/Reports/More tabs; live fleet map and vehicle list/detail; vehicle-scoped alert CRUD; separate History and Replay routes; grouped vehicle selection and report generation/export.
- Implemented: permission-gated Geofence and POI management from More; circles and polygons are drawn on a native map, geofences support editable color/radius/triggers, and POIs support map placement, radius, group, description, and shared icon search. API reads and CRUD enforce authenticated organization scope and View/Add/Edit/Delete permissions.
- Implemented: Driver Behavior in More, guarded by `driver-behavior` role permissions; compact 30-day average fleet-score line chart above the leaderboard, per-vehicle score history/events, and editable organization thresholds/deductions when `edit` is granted. API scopes client trend/leaderboard/detail data to the authenticated organization and custom vehicle access; score deletion remains internal-admin-only.
- Implemented: organization Users management in More, guarded by `users.view` and per-action grants. The native editor supports profile, group-aware all/specific vehicle scope, permission templates, module grants and self-delete/self-role protections. The API enforces organization, role hierarchy, action-grant limits and vehicle scope for direct requests. Apply migration `027_extended_user_permissions.sql` before deploying the API; its nullable fields provide per-user Behavior, Reports and Users overrides with role-default inheritance.
- Implemented: opt-in mobile push registration on the Alerts screen, per-rule mobile-push and sound switches, five bundled tones plus the shared uploaded WAV catalogue, in-app previews, foreground notifications, authenticated alert-event deep links, and an event detail route. API delivery targets only active same-organization users with effective `alerts.view` and access to the triggering vehicle. Token ownership is derived from the authenticated account; alert-event detail rechecks organization and vehicle scope. Apply migrations 025 and 026 before deploying the API. The Expo local native module downloads and installs active catalogue sounds and registers platform notification sounds at runtime; one EAS binary containing that module is required, but later uploads do not require rebuilding the app. Older app registrations retain their built-in fallback.
- Implemented: More > Notifications & refresh contains per-device push enable/disable, a global sound preference for the registered device, and optional fleet refresh when the app returns to the foreground. Sound preference is stored on the owned push-token row and combined with the alert rule's sound setting; its API endpoint must verify token ownership and effective `alerts.view`. Apply migration `028_mobile_push_preferences.sql` before deploying the API. Fleet polling pauses outside the foreground to protect battery; returning to the app triggers one configurable refresh. Remote push handles alerts while the app is closed.
- Implemented: More > Device Health requires `vehicles.view` and reads the shared `GET /telemetry/device-health` endpoint, which enforces organization and per-user vehicle scope. Show connection, GPS, GSM, external power, voltage and packet freshness; provide search, All/Needs attention/Offline filters, retry and pull-to-refresh. Poll every 30 seconds only while the route is focused; no database migration or native module is needed.
- Implemented: fleet-wide alert-rule list/create/edit/delete in Alerts with a three-step wizard, searchable grouped vehicle selection, optional organization-wide targeting, alert configuration, schedules, and mobile push preferences. Organization-wide creation/editing is exposed only when the caller's full-fleet scope is confirmed; API list responses redact inaccessible targets and disable mutations when the caller cannot manage the complete target scope. Optional group/geofence/device lookups fail independently so missing auxiliary permissions do not hide alert rules.
- New mobile-created alert rules default `notifications.appPush` to enabled in both fleet and vehicle-specific forms; editing preserves an explicit saved `false` but treats a missing legacy value as enabled. The Alerts screen restores its registered push state from SecureStore before retrying registration, and shows a checking state while OS permission is checked. Keep the mobile-notifications row flat without an outer border, form content scrollable, and the save action keyboard-safe on both platforms.
- In the alert-type step, show any numeric trigger value before the long type selector, with a clear label and helper, so users notice and understand the threshold. Seed the actual config with the same default shown in the input whenever the selected type changes. In Settings, keep the Mobile Push option visually flat without a surrounding card border.
- Fleet alert creation/edit uses the root Expo Router stack route `/alert-rule`, not a native full-screen Modal, so system status-bar safe areas and native back gestures work like other pages. Keep the step header below the top inset and the sticky primary action clear of the home indicator; returning after save refreshes Alerts on focus.
- After successful sign-in, dismiss the public onboarding/login history before replacing with `/map`; a hardware or swipe back from the authenticated app must never reveal Get Started.
- Still pending: Apply migrations 025–029 in production before deploying the API (migration 024 is already applied); build and install one EAS binary containing the local sound module, then test upload-to-device playback on physical Android and iOS devices. Android signing/FCM credentials and iOS Apple Developer/APNs credentials are required for signed remote-push QA. Later sound uploads are database-backed and do not require a new EAS binary. Device health workflow remains pending. Expo Go includes `expo-sharing`; a distributable EAS binary must include the module. See `docs/FEATURE_MATRIX.md` for the concise parity list.
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

- Push notifications with deep links to the relevant vehicle/event, five bundled WAV tones, and uploaded shared WAV tones. Dynamic Android sound filenames must use lowercase letters, digits, and underscores; channels are immutable, so use a stable channel ID per uploaded sound. Register dynamic sound capability and IDs only after those sounds are installed on the device. Keep built-in tones as fallback for older clients or not-yet-installed uploads. Do not prompt at app launch; request permission from Alerts. Register Expo tokens only for authenticated client users with effective `alerts.view`. Include the event log ID in notification data and revalidate tenant and vehicle access on detail fetch. Send push only for rules with `notifications.appPush === true`; default legacy `appSound` to enabled and `appSoundId` to `trackvee`, and send silent pushes only through the provisioned silent channel.
- Alert tone previews use Expo Audio with `interruptionMode: 'mixWithOthers'`, stop when the selector closes or another preview starts, and require no microphone permission. Let `useAudioPlayer` release the native player on unmount; do not call `pause()` from a passive-effect cleanup, because the hook may already have released the native shared object. Preview and delivery share the active API catalogue; downloaded files are authenticated and cached locally.
- Foreground/background refresh behavior that respects battery usage.
- Do not continuously poll tracker data while the app is suspended. Use remote push for closed-app alerts and perform a single fleet refresh when the app returns to the foreground if the user has enabled it; OS-scheduled background tasks are deferred and cannot promise live tracking.
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
- Maintenance is available from More and uses the `maintenance` role/custom permission. Keep service records tenant- and vehicle-scoped in the API. Log Service uses a searchable, grouped `/vehicle-groups` vehicle picker, modal service-type/date pickers, a 500–10,000 km service-distance picker added to the entered service odometer, separate Service Details/Next Due/Reminders sections, no Provider field, and blank reminder leads until entered. Required fields must be marked and validated; optional service odometer/cost/notes remain optional unless a distance reminder is selected, when the service odometer is required. Dates display as `DD-MM-YYYY`, while API values stay `YYYY-MM-DD`. Due reminders use the latest record per vehicle/service type. Mileage reminders use the entered service odometer plus GPS-derived distance; label it Estimated and never imply it is a tracker-reported odometer. Maintenance alert rules choose a service type and are evaluated on the next valid telemetry packet (not by a wall-clock scheduler); push follows the rule's mobile push/sound settings. Apply migration 029 before API deployment.
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
