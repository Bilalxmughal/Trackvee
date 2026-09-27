# Alerts, Geofences, POIs and Speed Zones

## Alerts

- Three-step rule wizard: identity/vehicles, type/configuration, schedule/notifications.
- Vehicle selection supports groups and defensive null guards.
- Vehicle menu can pre-seed alert creation by IMEI.
- Active/inactive filtering, edit/delete menu, English validation.

## Geofences

- Circle and polygon creation happens on the main map.
- Circle supports center picking and exact/slider radius.
- Polygon supports point list, removal, clear and valid >= 3 point submission.
- Enter/exit/both triggers and color picker follow the existing admin implementation.
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
