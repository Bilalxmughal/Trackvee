# YoTrack — Vehicle Tracking Platform

> Master project documentation. Update this file whenever a meaningful change is implemented.

---

## Overview

YoTrack is a professional vehicle tracking and fleet management SaaS platform built for the Pakistani market. It operates as a GPS tracking service provider — similar to aitrack.pk — offering B2C and B2B tracking solutions.

---

## Business Model

### B2C
```
YoTrack → Individual Customer → Vehicles (1-N)
```
An individual customer (e.g., Ali) registers, adds their vehicles, installs GPS devices, and tracks them via the portal and mobile app.

### B2B
```
YoTrack → Organization (e.g., ABC Logistics) → Users (multiple roles) → Vehicles (fleet)
```
A company registers, creates users with different roles, manages their fleet. Strict tenant isolation — one company never sees another's data.

---

## Device

| Field | Value |
|-------|-------|
| Brand | Auto Telematics Pvt. Ltd. |
| Model Label | ATS-GO |
| Protocol Model | AOT06 / AT06 |
| IMEI | 352312094973289 |
| SIM Operator | Ufone (Postpaid) |
| Voltage | 9-90V |
| Connection | Direct hardwire (3 wires) |
| Positioning | GPS + BDS + LBS |
| Current Server | aitrack.pk (to be migrated to YoTrack) |

### Device Protocol: AT06
- Transport: TCP over GPRS
- Format: Text-based, pipe-delimited ASCII
- Header: `$$`
- CRC: CRC-16 Modbus
- Frame: `$$[Len][IMEI]|[Alarm][UTCTime]|[GPSStatus]|[Lat]|[N/S]|[Lon]|[E/W]|[Speed]|[Heading]|[HDOP]|[Status]|[Voltage]|[ADC]|[LACCI]|[Temp]|[Mileage]|[Serial]|[CRC]`

### Device Reconfiguration SMS
To redirect device to YoTrack server (send to SIM in device):
```
SERVER,1,[your-domain],5023,0#
```

---

## Architecture

```
ATS-GO Device
    ↓ TCP (AT06 Protocol, Port 5023)
apps/gateway — TCP Gateway + AT06 Decoder
    ↓
apps/api — NestJS REST API + WebSocket
    ↓               ↓
PostgreSQL        Redis
(all data)    (live state/cache)
    ↓
apps/admin  — React Admin Portal    (port 5173)
apps/portal — React Customer Portal (port 5174)
apps/mobile — React Native          (later)
apps/website— Next.js               (later)
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| TCP Gateway | Node.js 22 (built-in `net` module) |
| API Server | NestJS 10 |
| Database | PostgreSQL + PostGIS |
| Cache / Live State | Redis |
| Real-time | WebSocket (Socket.io via NestJS) |
| Admin Portal | React 18 + Vite + TypeScript + Tailwind |
| Customer Portal | React 18 + Vite + TypeScript + Tailwind |
| Mobile App | React Native (Phase 7) |
| Website | Next.js (Phase 8) |
| Package Manager | pnpm (workspaces) |
| Language | TypeScript throughout |

---

## Project Structure

```
yotrack/
├── apps/
│   ├── gateway/     TCP Server — receives AT06 data from devices
│   ├── api/         NestJS REST + WebSocket API
│   ├── admin/       React Admin Portal (port 5173)
│   ├── portal/      React Customer Portal (port 5174)
│   ├── mobile/      React Native (Phase 7)
│   └── website/     Next.js (Phase 8)
├── packages/
│   ├── types/       Shared TypeScript interfaces
│   ├── protocol/    AT06 protocol decoder + CRC validator
│   └── utils/       Logger and common utilities
├── .env.example     Environment variable template
├── package.json     pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── PROJECT.md       This file
```

---

## UI / Design System

| Decision | Value |
|----------|-------|
| Theme | Clean Light |
| Brand Color | Red — `#dc2626` |
| Icon Library | Tabler Icons (outline only) |
| Status Style | Colored left border on row + colored text |
| Pills/Badges | Never used for status |
| Map Style | Google Maps (light road map) |
| Sidebar | Icon-only, 56px wide |
| Tables | Simple border, no alternating rows |
| Mobile | Responsive |
| Language | English only |

---

## Roles & Permissions

| Role | Access |
|------|--------|
| `super_admin` | Everything — all tenants, all data |
| `admin` | YoTrack operations — customers, devices |
| `org_owner` | Own organization — all data |
| `org_admin` | Own organization — most features |
| `org_user` | Own organization — assigned features only |
| `customer` | Own vehicles only (B2C) |

---

## Infrastructure

| Stage | Platform | Cost |
|-------|----------|------|
| Now (Development) | Oracle Cloud Free Tier | $0 |
| Growth | Hetzner Cloud | ~€4-6/month |
| Scale | Hetzner Dedicated / Managed | €10-20/month |

Oracle Free Tier:
- VM 1: Gateway + API + Redis
- VM 2: PostgreSQL
- TCP Ports required: 5023 (device), 3000 (API), 80/443 (web)

---

## Environment Variables

See `.env.example` for all required variables.
Never commit `.env` to git.

---

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 0 — Discovery | ✅ Complete | Device, protocol, business model, design |
| 1 — Architecture | ✅ Complete | System design, DB schema, tech stack approved |
| 2 — Foundation | ✅ Complete | Monorepo, types, protocol decoder, app skeletons |
| 3 — Device Integration | ⏳ Next | TCP gateway live, device connected to YoTrack |
| 4 — Database + API | ⬜ Pending | Schema, auth, RBAC, core API endpoints |
| 5 — Admin Portal | ⬜ Pending | Full admin UI |
| 6 — Customer Portal | ⬜ Pending | B2C + B2B portal |
| 7 — Mobile App | ⬜ Pending | React Native |
| 8 — Website | ⬜ Pending | Next.js public site |
| 9 — Testing | ⬜ Pending | Full test coverage |
| 10 — Deployment | ⬜ Pending | Production infrastructure |

---

## Security Requirements

- JWT authentication (access + refresh tokens)
- Password hashing (bcrypt)
- Tenant isolation enforced at API + DB level
- No secrets in source code (use .env)
- HTTPS in production
- TCP gateway validates IMEI before processing
- Input validation on all API endpoints (class-validator)
- Rate limiting (Phase 4)
- Audit logs (Phase 4)

---

## Known Decisions

- Device currently on aitrack.pk — SMS command needed to migrate to YoTrack server
- Maps: Google Maps API (key required when implementing)
- Notifications: Push + SMS — provider TBD in Phase 4
- Billing: TBD — not in initial phases

---

## Next Steps (Phase 3)

1. Set up Oracle Cloud server
2. Open port 5023 (TCP) in firewall
3. Deploy gateway app to server
4. Get server public IP / domain
5. Send SMS to device to redirect to YoTrack server
6. Verify device connection and data in gateway logs
