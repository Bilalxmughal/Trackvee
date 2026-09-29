# Alerts, Geofences, POIs and Speed Zones

## Alerts

- Three-step rule wizard: identity/vehicles, type/configuration, schedule/notifications.
- Vehicle selection supports groups and defensive null guards.
- Vehicle menu can pre-seed alert creation by IMEI.
- Maintenance alert rules store `config.serviceType` (and `customServiceType` when Other is chosen). Telemetry evaluates the latest matching maintenance record and logs once per service-record ID; maintenance state stays organization/vehicle scoped.
- Active/inactive filtering, edit/delete menu, English validation.
- Mobile push is opt-in per device and per rule. Deliver only to active client users in the alert organization who have effective `alerts.view` and access to the triggering vehicle; notification taps fetch the event through the authenticated, tenant-scoped detail endpoint.
- When per-alert mobile push is enabled, expose a separate sound toggle and a tone selector populated from the shared active sound catalogue, alongside the five built-in tones. Keep `appSound`/`appSoundId` in alert `notifications` JSON; default missing legacy sound fields to enabled/Trackvee. Uploaded sounds use opaque catalogue UUIDs and validated PCM WAV files. Mobile clients advertise only sounds installed on that device; Android uses a stable per-sound notification channel, while clients without the installed tone fall back to the built-in Trackvee tone.
- Push-token rows are bound to the authenticated user and organization. Remove only the caller's token; never accept owner or organization IDs from the client.
- `supports_custom_sounds`, `supports_dynamic_sounds`, and installed sound IDs on a push-token row are device capability fields, not authorization flags. Apply migrations 025 and 026 before deploying the API. Only internal sound managers may upload or activate catalogue items; client users may list active sounds and fetch active audio only when they have effective `alerts.view` access. A native app update is needed once to install the runtime sound module; later catalogue uploads do not require another EAS build.

## Geofences

- Circle and polygon creation happens on the main map.
- Circle supports center picking and exact/slider radius.
- Polygon supports point list, removal, clear and valid >= 3 point submission.
- Enter/exit/both triggers and color picker follow the existing admin implementation.
- Persist enter and exit trigger preferences in `geofences`; migration 023 adds the columns.
- Filter invalid stored points before rendering.

## POIs

- Map location picking, radius, group, description and shared icon library.
- Use the existing POI icon picker; do not create a competing category/icon system.
- Keep list/map state synchronized after create/edit/delete.

## Speed zones

- Circle and polygon zones with configured speed limit.
- Integrates with `speed_zone` alert type.
- Apply the same malformed-coordinate guards used for geofences.

## Tenant and permission rules

All list and CRUD operations are organization-scoped. Admin client selection may pass `orgId`; portal derives organization from authenticated user. Apply module View/Add/Edit/Delete permission guards.

## Primary sources

- Admin: `AlertsModal.tsx`, `GeofencesModal.tsx`, `POIsPanel.tsx`, `MapPage.tsx`.
- Portal: `AlertsPanel.tsx`, `GeofencesPanel.tsx`, `POIsPanel.tsx`, `MapPage.tsx`.
- API: `alerts/`, `geofences/`, `pois/`, `speed-zones/`.
