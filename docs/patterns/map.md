# Map and Vehicle Interaction Patterns

## Vehicle state and rows

- Moving: speed >= 5 km/h.
- Idle: speed < 5 km/h and ignition on.
- Parked: speed < 5 km/h and ignition off.
- Offline is based on stale telemetry.
- The API derives Moving/Idle/Parked/Offline from the last three valid GPS fixes and returns `vehicleStatus` so admin, portal, and mobile show one shared state. Moving starts at 5 km/h; tolerate a single low/noisy deceleration fix, confirm a stop after two consecutive fixes at or below 2 km/h, and use consistent displacement to recognize crawling movement. Offline begins when the newest valid GPS fix is older than 10 minutes.
- Stop duration is available only for a fresh vehicle with at least two consecutive valid GPS fixes at or below 2 km/h after the last fix above 2 km/h. Calculate from the first fix in that stationary run; show no duration when the current fix is stale or a stop is not confirmed.
- A five-second UI refresh is only a request cadence. It cannot make a tracker transmit more often; device acquisition and sending intervals are configured on the tracker.
- For GT06 live ingestion, persist each valid GPS frame through the API before acknowledging it to the device. Bound request retries/timeouts and serialize socket parsing; on exhausted persistence retries close the connection without ACK so the tracker can reconnect/retry. Client polling must never allow an older response to replace a newer live point.
- Vehicle row: 3px state-colored left border, plate, speed, power/battery/signal, three-dot menu.
- Client portal live map: render map markers, grouped rows, and live status counts from active, unexpired telemetry only. Separately load the tenant-scoped `/vehicles` list and show expired (including date-expired) vehicles at the bottom of the left panel with a red left rule and `Expired` text; these rows have no live actions and never create map markers or live counts. Refresh vehicle/device metadata periodically while the map stays open.

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

- History API reads use ascending `(timestamp, id)` order and bounded 2,000-row offset pages. Admin, portal and mobile must keep loading pages until a short page is returned; one capped response can omit late-day stops and misstate route start/end.
- Filter every History/Replay surface to valid, finite, in-range GPS fixes before deriving the route endpoints; discard (0, 0) fixes.
- Parked segments may span a >10-minute telemetry gap only when both fixes explicitly report ignition OFF and are within 100 m. For shorter gaps, parked points must still stay within 100 m. Do not infer a stop from silence alone or count a long location jump as parked time.
- Route: red `#dc2626`, weight 3.5, opacity 0.85.
- Direction arrows: blue SVG, bearing rotation, sampled to about 200 markers, moving points only.
- Parked marker: red `P`, idle marker: amber `I`, both 26px with white border and shown for >= 2 minutes.
- START is a green circle (`S`); END is a red circle (`E`), rendered above stop markers. Parked `P` markers are black; idle `I` markers are amber.
- Driving timeline selection highlights green, fits bounds, and opens midpoint popup with timestamps, reverse-geocoded addresses, duration and average speed.
- Cache reverse geocoding by rounded coordinates.

## Defensive map rules

- Filter malformed polygon points before `L.polygon`; skip shapes with fewer than three valid points.
- Keep react-leaflet v4.
- Custom DivIcon markers require `leaflet-interactive` when they must receive pointer events.
- For large live fleets, preserve `points`/trail references when a poll contains no changes, memoize filtered map data, and animate only moving or transitioning marker IDs. Keep marker animation at or below 30 FPS; update stale/offline marker appearance without rerunning coordinate snapping for every vehicle. Ignore delayed road-snap results when a newer GPS fix has already replaced that vehicle's coordinates.
- Follow windows must open in free viewport slots and snap to the nearest free grid slot on drag release, so they never rest overlapping. Drag movement should update the window element directly and commit React state once on release, so mini Leaflet maps do not rerender on every pointer event. When no free slot exists, ask the operator to close a window instead of stacking another one.

## Primary sources

- `apps/admin/src/pages/MapPage.tsx`
- `apps/portal/src/pages/MapPage.tsx`
