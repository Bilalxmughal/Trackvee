# Reports Pattern

## Coverage

Thirteen report types in five groups:

- Travel: travel summary, stops/move summary, stoppage summary, move summary, daily travel.
- Activity: ignition on/off, vehicle history.
- Speed: overspeed, overspeed summary, underspeed.
- Events: alert history, driver behavior.
- Geofence: geofence activity.

## Filters

- Group-aware multi-vehicle selection with search and Select All/Deselect All.
- Period: Today, Yesterday, This Week, Last Week, This Month, Last Month.
- From/To datetime.
- Conditional speed limit, minimum stop, minimum speed, and geofence fields.
- Group By: None, Day, Week, Month.

## API contract

`GET /reports` accepts type, comma-separated vehicle IDs, date range, conditional filters and groupBy.

Response rows are two-dimensional arrays:

```ts
{ columns: string[]; rows: (string | number | null)[][]; summary: (string | number | null)[] | null }
```

Render values by column index, not object key.

## Output and saved reports

- Result search.
- CSV API export.
- Client-side Excel through `xlsx`.
- Print layout.
- Save, load, and delete report configurations through `/reports/saved`.
- Save reusable scheduled-report templates from saved reports through `/reports/schedules`; edit title, report/filter source, time window, delivery time, and recipients, then activate, pause, or delete. Daily windows and delivery times use `Asia/Karachi`, while rolling periods are recalculated on every delivery.
- Scheduled CSVs always go to the schedule owner's current account email and may include up to 10 additional addresses entered by that owner. API rechecks account status, organization membership, reports access, vehicle grants, and selected geofences at delivery time.
- Server delivery requires `RESEND_API_KEY` and a verified sender in `REPORT_EMAIL_FROM`; see `docs/DEPLOYMENT.md`.
- Every client report query must constrain vehicles and any selected geofences to the caller's organization. An unfiltered Geofence Activity report must load only that organization's geofences.

## Primary sources

- `apps/api/src/reports/`
- `apps/admin/src/pages/ReportsPage.tsx`
- `apps/portal/src/components/ReportsModal.tsx`
- `apps/portal/src/components/VehicleMultiSelect.tsx`
