# Driver Behavior Pattern

## Views

Driver Behavior provides a leaderboard and settings. Selecting a leaderboard row opens an inline vehicle detail view within the same modal.

Vehicle detail includes:

- Summary counts for harsh brake, rapid acceleration, sharp turn and overspeed.
- Thirty-day SVG score trend.
- Events table with event, severity, speed, formatted time and map location view.

Score colors: >= 80 green, >= 60 amber, below 60 red.

## APIs

- `GET /driver-behavior/leaderboard`
- `GET /driver-behavior/vehicle/:vehicleId/scores?days=30`
- `GET /driver-behavior/vehicle/:vehicleId/events`
- `GET /driver-behavior/settings`
- `PUT /driver-behavior/settings`

## Settings

Detection thresholds: overspeed, harsh braking deceleration, rapid acceleration, sharp turn angle and sharp-turn minimum speed.

Score deductions: harsh brake, rapid acceleration, sharp turn and overspeed.

Use the same labels, units and endpoint behavior in admin and portal. Portal uses hardcoded light-theme colors.

## Primary sources

- `apps/admin/src/pages/DriverBehaviorPage.tsx`
- `apps/admin/src/components/DriverBehaviorPanel.tsx`
- `apps/portal/src/components/DriverBehaviorModal.tsx`
- `apps/portal/src/components/DriverBehaviorPanel.tsx`
- `apps/api/src/driver-behavior/`
