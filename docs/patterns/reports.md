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

## Primary sources

- `apps/api/src/reports/`
- `apps/admin/src/pages/ReportsPage.tsx`
- `apps/portal/src/components/ReportsModal.tsx`
- `apps/portal/src/components/VehicleMultiSelect.tsx`
