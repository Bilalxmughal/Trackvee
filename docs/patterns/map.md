# Map and Vehicle Interaction Patterns

## Vehicle state and rows

- Moving: speed >= 5 km/h.
- Idle: speed < 5 km/h and ignition on.
- Parked: speed < 5 km/h and ignition off.
- Offline is based on stale telemetry.
- Vehicle row: 3px state-colored left border, plate, speed, power/battery/signal, three-dot menu.

## Vehicle menu order

1. Follow Vehicle
2. Divider
3. Trip Replay
4. Street View
5. Divider
6. History: Last Hour, Today, Yesterday
7. Divider
8. Create Alert/Edit Alert
9. Divider
10. Cut Engine/Restore Engine

The menu is fixed-positioned from the trigger bounding rectangle. Hover uses red text and `#fff5f5`.

Alert presence: `alerts.some(a => a.active && a.vehicleImeis.includes(imei))`.

## Engine command confirmation

- Titles: `Engine Cut Confirm` / `Engine Restore Confirm`.
- Require the final four IMEI digits; numeric, centered, letter spacing 8, max length 4.
- Enter submits; Escape closes.
- API: `POST /devices/:imei/command` with `immobilize` or `activate`.
- Error: `Incorrect digits - please try again`.

## History layer

- Route: red `#dc2626`, weight 3.5, opacity 0.85.
- Direction arrows: blue SVG, bearing rotation, sampled to about 200 markers, moving points only.
- Parked marker: red `P`, idle marker: amber `I`, both 26px with white border and shown for >= 2 minutes.
- Start: green dot; end: black dot; ignition-off STOP marker: amber.
- Driving timeline selection highlights green, fits bounds, and opens midpoint popup with timestamps, reverse-geocoded addresses, duration and average speed.
- Cache reverse geocoding by rounded coordinates.

## Defensive map rules

- Filter malformed polygon points before `L.polygon`; skip shapes with fewer than three valid points.
- Keep react-leaflet v4.
- Custom DivIcon markers require `leaflet-interactive` when they must receive pointer events.

## Primary sources

- `apps/admin/src/pages/MapPage.tsx`
- `apps/portal/src/pages/MapPage.tsx`
