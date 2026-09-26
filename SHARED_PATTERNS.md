# YoTrack Shared Patterns & Design Reference

> This file is the single source of truth for UI patterns, component logic, and design decisions that are shared between `apps/admin` and `apps/portal`. When implementing a feature in portal that already exists in admin, always match this reference exactly unless explicitly told otherwise.

---

## 1. Design System

| Token | Value |
|---|---|
| Primary red | `#dc2626` |
| Primary red hover bg | `rgba(220,38,38,0.05)` / `#fff5f5` |
| Border | `#e5e7eb` |
| Surface bg | `#fafafa` / `#f7f7f7` |
| Body text | `#111` |
| Secondary text | `#6b7280` |
| Muted text | `#9ca3af` |
| Label text | `#bbb` |
| Success | `#16a34a` |
| Warning | `#f59e0b` |
| Offline | `#6b7280` |

**Portal is light-theme only** — no CSS variables, hardcoded hex values. Admin supports dark/light; portal always uses the light values.

---

## 2. Status Colors

```ts
const STATUS_COLOR = { moving: '#16a34a', idle: '#f59e0b', parked: '#6b7280', offline: '#9ca3af' };
```

3-state speed model: `>= 5 km/h` = moving, `< 5 km/h + ignition on` = idle, `< 5 km/h + ignition off` = parked.

---

## 3. Vehicle List Row

Each vehicle row has:
- Left colored border: `3px solid STATUS_COLOR[status]`
- Plate text (bold, 12px)
- Speed (10px, right-aligned, `#9ca3af`)
- IconPower / IconBattery / IconSignal indicators
- **3-dot VehicleMenuButton** (see §4)

Hover background: `#f9fafb` (light) / `#1e1e1e` (admin dark).

---

## 4. Vehicle 3-Dot Menu (VehicleMenuButton)

**Menu items in order:**
1. Follow Vehicle
2. `──` divider
3. Trip Replay
4. Street View (opens `https://maps.google.com/maps?layer=c&cbll=${lat},${lon}`)
5. `──` divider
6. History: Last Hour
7. History: Today
8. History: Yesterday
9. `──` divider
10. **Create Alert** / **Edit Alert** (based on `hasAlert`)
11. `──` divider
12. **Cut Engine** / **Restore Engine** (red, opens confirm dialog)

**Dropdown position:** `position: fixed`, calculated from `btnRef.getBoundingClientRect()` as `{ top: r.bottom + 4, right: window.innerWidth - r.right }`.

**Hover style:** `background: #fff5f5`, `color: #dc2626` on all items.

**hasAlert logic:** `alerts.some(a => a.active && a.vehicleImeis.includes(imei))` — uses the alerts array already loaded in MapPage state.

---

## 5. Engine Cut Confirm Dialog

Triggered by "Cut Engine" / "Restore Engine" menu item.

```
Title:     "Engine Cut Confirm" / "Engine Restore Confirm"  — #dc2626, 15px, bold
Body:      Vehicle: <plate>
           Enter the last 4 digits of the device IMEI to confirm:
Input:     maxLength=4, digits only, fontSize=20, textAlign=center, letterSpacing=8
           border 1.5px solid (red on error, #e5e7eb normal), background #f9fafb
           onKeyDown: Enter → submit, Escape → close
Buttons:   Cancel (flex:1) | Confirm (flex:1, #dc2626, disabled when input.length !== 4)
Error:     "Incorrect digits — please try again"
API:       POST /devices/:imei/command  { action: 'immobilize' | 'activate' }
```

zIndex: 10000, backdrop: `rgba(0,0,0,0.55)`.

---

## 6. History Layer (Map)

Applies to both admin live map history and portal history mode.

| Element | Style |
|---|---|
| Polyline | `#dc2626`, weight 3.5, opacity 0.85 |
| Arrow markers | Blue SVG polygon `fill="#2563eb"`, rotated by `calcBearing`, step = `max(1, floor(N/200))`, only where `speedKmh >= MOVING_SPEED (5)` |
| P marker (parked) | 26px circle, `#dc2626`, white border, label "P" — shown when stop ≥ 2 min |
| I marker (idle) | 26px circle, `#f59e0b`, white border, label "I" — shown when idle ≥ 2 min |
| STOP marker | Amber `#f59e0b` |
| Start dot | 14px green `#16a34a` |
| End dot | 14px black `#111` |

**Driving segment popup** (on segment click from timeline):
- Green highlight polyline `#16a34a`
- Popup at midpoint with: From/To timestamps + async Nominatim addresses, Duration, Avg Speed

**Reverse geocode:** `https://nominatim.openstreetmap.org/reverse?lat=&lon=&format=json` with `geocodeCache` Map (key = `lat.toFixed(3),lon.toFixed(3)`).

---

## 7. Reports

**Report types (13 total, 5 groups):**

| Group | Types |
|---|---|
| Travel | travel_summary, stops_move_summary, stoppage_summary, move_summary, daily_travel |
| Activity | ignition_on_off, vehicle_history |
| Speed | overspeed, overspeed_summary, underspeed |
| Events | alert_history, driver_behavior |
| Geofence | geofence_activity |

**Conditional fields:**
- `speed` opt → Speed Limit (km/h)
- `minStop` opt → Min Stop (min)
- `minSpeed` opt → Min Speed (km/h)

**API:** `GET /reports?type=&vehicleIds=&from=&to=&speedLimit=&minStopMin=&minSpeedKmh=&groupBy=`

**Response shape:** `{ columns: string[], rows: (string|number|null)[][], summary: (string|number|null)[] | null }`
— rows are **2D arrays**, NOT objects. Render as `row[colIndex]`.

**Period presets:** Today / Yesterday / This Week / Last Week / This Month / Last Month.

---

## 8. VehicleMultiSelect Component

Location: `apps/portal/src/components/VehicleMultiSelect.tsx`

Features: search, vehicle groups (with group-level toggle), Select All / Deselect All with dash indicator (partial state), individual toggle.

Checkbox states: `'all'` (✓ red), `'some'` (— dash red), `'none'` (empty).

Data APIs: `GET /vehicles` → `VehicleOption[]`, `GET /vehicle-groups` → `VehicleGroup[]`.

---

## 9. Driver Behavior Modal

**Tabs:** Driver Scores | Settings

**Score colors:** `>= 80` = `#16a34a` (green), `>= 60` = `#f59e0b` (amber), `< 60` = `#dc2626` (red).

**APIs:**
- Leaderboard: `GET /driver-behavior/leaderboard`
- Vehicle detail: `GET /driver-behavior/vehicle/:vehicleId/scores?days=30` + `GET /driver-behavior/vehicle/:vehicleId/events`
- Settings: `GET /driver-behavior/settings`, `PUT /driver-behavior/settings`

**Vehicle detail view** (on leaderboard row click — inline, not a separate modal):
- Back button → returns to leaderboard; tabs hidden while in detail view
- Summary tiles: Harsh Brake / Rapid Accel / Sharp Turn / Overspeed (amber for > 0, red for overspeed)
- 30-Day Score Trend: SVG line chart (`ScoreChart` component, hardcoded light colors: border `#e5e7eb`, text `#9ca3af`)
- Recent Events table: Event icon + label | Severity (colored uppercase) | Speed | Time (`DD-Mon-YYYY H:MM AM/PM`) | Location (map pin button → OSM iframe + Google Maps link → Back)
- Event icons: `harsh_brake=IconAlertTriangle`, `rapid_accel=IconGauge`, `sharp_turn=IconRotateClockwise`, `overspeed=IconArrowNarrowRight`
- Severity colors: `low=#6b7280`, `medium=#f59e0b`, `high=#dc2626`

**Settings fields (detection thresholds):** overspeedThreshold (km/h), harshBrakeDeceleration (km/h/s), rapidAccelThreshold (km/h/s), sharpTurnAngle (degrees), sharpTurnMinSpeed (km/h).

**Settings fields (deductions):** deductionHarshBrake, deductionRapidAccel, deductionSharpTurn, deductionOverspeed (all in pts).

---

## 10. Modals — Standard Pattern

All full-screen modals (Reports, Driver Behavior, Users):

```
backdrop:  position fixed, inset 0, zIndex 9998, rgba(0,0,0,0.7)
container: background #fff, borderRadius 12, width min(Xpx, 97vw), height min(Ypx, 96vh)
           display flex, flexDirection column, overflow hidden
header:    icon + title (15px, bold) + close button (X svg)
```

**No outside-click to close** — only the X button closes.

---

## 11. AlertsPanel — Pre-seed from Vehicle Menu

`AlertsPanel` accepts `initialImei?: string | null`. When set, it auto-opens the create form with that IMEI pre-selected. Passed via `key={createAlertImei ?? 'alerts'}` to force remount on new IMEI.

---

## 12. Panel Context (Portal)

`usePortalPanel()` returns: `{ activePanel, openPanel, closePanel, alertCount, setAlertCount }`.

Panel types: `'alerts' | 'geofences' | 'pois' | 'reports' | 'behavior' | 'users' | null`.

---

## 13. Map Groups (Portal)

Vehicle groups stored in `localStorage` key `yotrack_map_groups_v1` as `{ id, name, imeis }[]`. Admin uses server-side groups from `/vehicle-groups`.

---

## 14. Date / Time Format

Display format: `01-Jan-2026 10:00 AM` — consistent across all tables and panels.

---

## 15. Users Form (Portal UsersModal — UserFormModal)

**Tabs:** Profile | Vehicles | Permissions

**Profile tab field order:** Role → First Name / Last Name (grid) → Email → Password (with show/hide eye icon) → Status (Active/Inactive)

**Vehicles tab:**
- Radio: All vehicles / Specific vehicles
- When "Specific": group-wise vehicle list from `GET /vehicle-groups?organizationId=X`
- Each group has a header checkbox (toggle all vehicles in group)
- Individual vehicle checkboxes show plate number
- Ungrouped vehicles shown under "Other"
- Saved as `vehicleIds` array in `org_permissions`

**Permissions tab:**
- Dynamic: `ALL_MODULES.filter(m => canDo(m.portalKey, 'view'))` — only shows modules current user's role can access
- Per-module, only actions the current user can do are shown as toggleable; others show `—`
- **MODULE table:** Module | VIEW | ADD | EDIT | DELETE header row (colored per action), each cell = 26×26 toggle button
- **ACTION_COLOR:** View=`#3b82f6`, Add=`#16a34a`, Edit=`#f59e0b`, Delete=`#dc2626`
- Permissions tab shows for all roles except client_owner (fixed full access)
- Auto-grant View when Add/Edit/Delete is toggled on
- API: `GET /org-permissions/:userId` (load), `PUT /org-permissions/:userId` (save)

**ALL_MODULES (portalKey → permKey mapping):**
```ts
vehicles → vehicles (View/Add/Edit/Delete)
alerts → alerts (View/Add/Edit/Delete)
geofences → geofences (View/Add/Edit/Delete)
pois → pois (View/Add/Edit/Delete)
driver-behavior → driverBehavior (View/Edit)
reports → reports (View)
users → users (View/Add/Edit/Delete)
```

**Key rule:** Client admins can only grant permissions they themselves have — enforced by `canDo` filter on `visibleModules`.

---

## 16. Auth Separation (Login Role Guard)

**Portal** (`portal.trackvee.com`): only allows `client_owner`, `client_super_admin`, `client_admin`, `client_user`. Any other role → throw error → "Invalid email or password" shown.

**Admin** (`admin.trackvee.com`): only allows `super_admin`, `admin`, `ops`, `live_ops`, `agent`, `chat_support`, `viewer`. Any other role → throw error → "Invalid email or password" shown.

Both apps also check on token reload (`/auth/me`) — wrong-role token is cleared silently (user lands on login).

Rule: **never reveal** which portal the user should use in the error message.
