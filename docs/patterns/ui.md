# Shared UI Patterns

## Design tokens

- Primary: `#dc2626`; hover surface: `#fff5f5`.
- Border: `#e5e7eb`; surface: `#fafafa`; body: `#111`.
- Secondary: `#6b7280`; muted: `#9ca3af`.
- Moving/success: `#16a34a`; idle/warning: `#f59e0b`; parked/offline: `#6b7280`/`#9ca3af`.
- Portal is light-only. Admin supports its established light/dark behavior.
- Status uses flat colored text or left border, not decorative pills.
- Icons come from Tabler Icons; product UI never uses emoji.

## Full-screen modals

- Backdrop: fixed inset 0, z-index 9998, `rgba(0,0,0,0.7)`.
- Container: white, radius 12, `width: min(1200px, 97vw)`, `height: min(800px, 96vh)`, flex column, overflow hidden.
- Header: functional icon, 15px bold title, close button.
- Close via explicit close control; do not add outside-click closing unless the existing flow uses it.

## Settings navigation

- Keep the Settings side menu mounted while switching its sections. Use local selected-section state to replace only the right content pane; do not navigate between section URLs on menu clicks, which remounts the page and visibly shifts the layout.
- Deep links may initialize the selected section, but normal menu selection stays within the Settings page.

## Vehicle selection

Use existing `VehicleMultiSelect`/`VehicleGroupSelect`. Required behavior: search, groups, individual selection, group toggle, Select All/Deselect All, partial-state dash, defensive `?? []` guards.

Vehicle lists show plate first and Make/Model second. Display fallback is `[make, model].filter(Boolean).join(' ') || name`.

## Checkbox styling

Custom 15x15 checkbox, 3px radius, red checked state and white SVG checkmark. List rows remain transparent; hover uses the established light/dark surface. Do not highlight the entire checked row.

## Dates

Display date/time as `01-Jan-2026 10:00 AM` across tables, panels, exports where human-readable display is expected.

## Source references

- Portal vehicle selector: `apps/portal/src/components/VehicleMultiSelect.tsx`.
- Admin group selector: `apps/admin/src/components/VehicleGroupSelect.tsx`.
- Shared admin modal: `apps/admin/src/components/Modal.tsx`.
