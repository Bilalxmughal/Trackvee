# YoTrack — Vehicle Tracking Platform

> Master project documentation. Keep this file concise. It contains stable architecture, product rules, and permanent project context.
>
> **AI rule:** Do not turn this file into a history log. Record completed work in `CHANGELOG.md`, active state in `CURRENT_STATE.md`, known bugs in `KNOWN_ISSUES.md`, and architectural decisions in `DECISIONS.md`.

## 1. Overview

YoTrack is a professional vehicle tracking and fleet management SaaS platform for the Pakistani market. It operates as a GPS tracking service provider, offering B2B fleet tracking solutions.

### B2B Model

`YoTrack → Organization → Users → Vehicles`

Organizations have multiple users/roles and strict tenant isolation. One organization must never access another organization's data.

## 2. Current Product Scope

- GPS vehicle tracking (live + history)
- Vehicle/fleet management
- B2B multi-tenant organizations
- Role-based access (internal staff + client org users)
- Live vehicle state
- Historical telemetry data and trip detection
- Admin portal (production)
- Client portal (org users, permission-controlled)
- Driver behavior scoring
- Alerts and geofences
- POIs
- Mobile app planned
- Public website planned

## 3. Device

| Field | Value |
|---|---|
| Brand | Auto Telematics Pvt. Ltd. |
| Model Label | ATS-GO |
| Protocol Model | AOT06 / AT06 |
| Test IMEI | 352312094973289 |
| SIM Operator | Ufone (Postpaid) |
| Voltage | 9-90V |
| Connection | Direct hardwire (3 wires) |
| Positioning | GPS + BDS + LBS |

### AT06 Protocol

- Transport: TCP over GPRS
- Format: Text-based, pipe-delimited ASCII
- Header: `$$`
- CRC: CRC-16 Modbus
- Gateway port: `5023`
- Frame:
  `$$[Len][IMEI]|[Alarm][UTCTime]|[GPSStatus]|[Lat]|[N/S]|[Lon]|[E/W]|[Speed]|[Heading]|[HDOP]|[Status]|[Voltage]|[ADC]|[LACCI]|[Temp]|[Mileage]|[Serial]|[CRC]`

### Device Reconfiguration SMS

```text
SERVER,1,[your-domain],5023,0#
```

## 4. Architecture

```text
ATS-GO Device
    ↓ TCP / AT06 / Port 5023
apps/gateway — TCP Gateway + AT06 Decoder
    ↓
apps/api — NestJS REST API + WebSocket
    ↓              ↓
PostgreSQL       Redis
(all data)       (live state/cache)
    ↓
apps/admin  — React Admin Portal (Vercel)
apps/portal — React Client Portal (Vercel, same build)
apps/mobile — React Native (planned)
apps/website — Next.js (planned)
```

### Core architectural rules

- PostgreSQL is the persistent source of truth.
- Redis is for live state/cache only.
- Tenant isolation must be enforced at API + database level.
- Gateway validates device IMEI before processing.
- All API input must be validated.
- `synchronize: false` — all schema changes via SQL migration files.
- Do not change core architecture without recording the decision in `DECISIONS.md`.

## 5. Tech Stack

| Layer | Technology |
|---|---|
| TCP Gateway | Node.js 22 (`net`) |
| API | NestJS 10 |
| Database | PostgreSQL |
| Cache / Live State | Redis |
| Real-time | Socket.io via NestJS |
| Admin / Portal | React 18 + Vite + TypeScript |
| Map | react-leaflet v4 + OpenStreetMap |
| Mobile | React Native (planned) |
| Website | Next.js (planned) |
| Package Manager | pnpm workspaces |
| Language | TypeScript |

## 6. Project Structure

```text
yotrack/
├── apps/
│   ├── gateway/
│   ├── api/
│   │   └── migrations/  ← SQL migration files (0NN_description.sql)
│   ├── admin/
│   └── portal/
├── packages/
│   ├── types/           ← resolves from src/index.ts (not dist)
│   ├── protocol/
│   └── utils/
├── PROJECT.md
├── AI_RULES.md
├── CURRENT_STATE.md
├── CHANGELOG.md
├── DECISIONS.md
└── KNOWN_ISSUES.md
```

## 7. UI / Design System

| Decision | Value |
|---|---|
| Theme | Clean Light |
| Brand Color | Red — `#dc2626` |
| Icon Library | Tabler Icons (outline only) |
| Status Style | Colored left border + colored text (no pills/badges) |
| Map | react-leaflet v4, OpenStreetMap tiles |
| Sidebar | Icon-only, 56px |
| Tables | Simple border, no alternating rows |
| Mobile | Responsive |
| Language | English only in all UI copy |
| Emoji | Never used as UI icons or decorations |

## 8. Roles & Permissions

### Internal Staff (admin portal)

| Role | Access |
|---|---|
| `super_admin` | Everything — all orgs, all data |
| `admin` | YoTrack operations — orgs, devices |
| `ops` | Operational access |
| `live_ops` | Live map, live state |
| `agent` | Customer-facing support |
| `chat_support` | Chat/support access |
| `viewer` | Read-only |

### Client Organization Users (client portal)

| Role | Access |
|---|---|
| `client_owner` | Full org access, can manage permissions |
| `client_super_admin` | Full org access |
| `client_admin` | Most org features |
| `client_user` | Assigned features only (controlled via DB role_portal_permissions) |

**Rule:** Client portal page access is controlled by the `role_portal_permissions` DB table. Every new feature must add default rows for all four client roles in the migration.

## 9. Infrastructure (Production)

| Component | Platform |
|---|---|
| API | Oracle Cloud Free Tier VM, PM2, port 3000 |
| Gateway | Oracle Cloud VM, port 5023 |
| PostgreSQL | Oracle Cloud VM |
| Redis | Oracle Cloud VM |
| Nginx | Reverse proxy on Oracle Cloud VM |
| Admin/Portal | Vercel (auto-deploy from main) |
| DNS | Hostinger, trackvee.com |

**Deploy procedure (every API change):**
```bash
git pull origin main
pnpm --filter api build
pm2 restart yotrack-api
```

## 10. Security Requirements

- JWT authentication (access + refresh tokens)
- Password hashing (bcrypt)
- Tenant isolation at API + DB level
- No secrets in source code; use `.env`
- HTTPS in production
- Gateway validates IMEI
- Input validation on all API endpoints
- INTERNAL_API_KEY for gateway→API communication (env only)

## 11. Phase Status

| Phase | Status |
|---|---|
| 0 — Discovery | Complete |
| 1 — Architecture | Complete |
| 2 — Foundation | Complete |
| 3 — Device Integration | Complete |
| 4 — Core API + Auth | Complete |
| 5 — Admin Portal | Complete |
| 6 — Client Portal | Complete |
| 7 — Driver Behavior | Complete |
| Feature Backlog | Ongoing |
| 8 — Mobile App | Planned |
| 9 — Public Website | Planned |

## 12. Documentation System

- `AI_RULES.md` — how AI should work in this repository.
- `CURRENT_STATE.md` — what is working, in progress, blocked, and next.
- `CHANGELOG.md` — concise record of completed features/fixes.
- `DECISIONS.md` — important technical/product decisions and their reasons.
- `KNOWN_ISSUES.md` — known bugs, limitations, and warnings.

**Important:** When a change is implemented, update only the relevant documentation file. Keep entries short and factual.
