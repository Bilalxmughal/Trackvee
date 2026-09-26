import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SavedReport } from './entities/saved-report.entity.js';
import { Telemetry } from '../telemetry/entities/telemetry.entity.js';
import { Device } from '../devices/entities/device.entity.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { AlertLog } from '../alerts/entities/alert-log.entity.js';
import { Alert } from '../alerts/entities/alert.entity.js';
import { DriverEvent } from '../driver-behavior/entities/driver-event.entity.js';
import { Geofence, CircleCoords, PolygonCoords } from '../geofences/entities/geofence.entity.js';

export type ReportType =
  | 'travel_summary' | 'stops_move_summary' | 'stoppage_summary' | 'move_summary'
  | 'ignition_on_off' | 'overspeed' | 'overspeed_summary' | 'underspeed'
  | 'daily_travel' | 'vehicle_history' | 'alert_history' | 'driver_behavior'
  | 'geofence_activity';

export interface ReportParams {
  type: ReportType;
  vehicleIds: string[];
  from: Date;
  to: Date;
  speedLimit?: number;
  minSpeedKmh?: number;
  minStopMin?: number;
  geofenceIds?: string[];
  organizationId?: string; // set for client users — enforces tenant isolation
}

export interface ReportResult {
  type: ReportType;
  from: string;
  to: string;
  generatedAt: string;
  vehicleCount: number;
  rowCount: number;
  columns: string[];
  rows: (string | number | null)[][];
  summary: (string | number | null)[] | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtMs(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}min ${sec}s`;
  if (m > 0) return `${m}min ${sec}s`;
  return `${sec}s`;
}

function fmtDt(d: Date): string {
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const hh = d.getHours(), ampm = hh >= 12 ? 'PM' : 'AM';
  const h12 = String(hh % 12 || 12).padStart(2, '0');
  return `${String(d.getDate()).padStart(2,'0')}-${mo}-${d.getFullYear()} ${h12}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')} ${ampm}`;
}

function fmtDate(d: Date): string {
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return `${String(d.getDate()).padStart(2,'0')}-${mo}-${d.getFullYear()}`;
}

function latLng(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

const MOVING = 5; // km/h threshold

interface Seg {
  type: 'move' | 'stop';
  pts: Telemetry[];
  startTime: Date;
  endTime: Date;
  ms: number;
  distKm: number;
  maxSpd: number;
  avgSpd: number;
}

function segment(pts: Telemetry[]): Seg[] {
  if (pts.length < 2) return [];
  const segs: Seg[] = [];
  let si = 0;
  let cur: 'move' | 'stop' = pts[0].speedKmh >= MOVING ? 'move' : 'stop';

  const flush = (end: number) => {
    const slice = pts.slice(si, end);
    if (!slice.length) return;
    let dist = 0, maxSpd = 0, sumSpd = 0, mc = 0;
    for (let i = 1; i < slice.length; i++) {
      dist += haversineKm(slice[i-1].latitude, slice[i-1].longitude, slice[i].latitude, slice[i].longitude);
      if (slice[i].speedKmh > maxSpd) maxSpd = slice[i].speedKmh;
      if (slice[i].speedKmh >= MOVING) { sumSpd += slice[i].speedKmh; mc++; }
    }
    const startTime = new Date(slice[0].timestamp);
    const endTime   = new Date(slice[slice.length-1].timestamp);
    segs.push({ type: cur, pts: slice, startTime, endTime, ms: endTime.getTime() - startTime.getTime(), distKm: dist, maxSpd, avgSpd: mc ? sumSpd / mc : 0 });
  };

  for (let i = 1; i < pts.length; i++) {
    const t: 'move' | 'stop' = pts[i].speedKmh >= MOVING ? 'move' : 'stop';
    if (t !== cur) { flush(i); cur = t; si = i; }
  }
  flush(pts.length);
  return segs;
}

function pointInPolygon(lat: number, lng: number, points: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [yi, xi] = points[i], [yj, xj] = points[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inGeofence(pt: Telemetry, gf: Geofence): boolean {
  if (gf.type === 'circle') {
    const c = gf.coordinates as CircleCoords;
    return haversineKm(pt.latitude, pt.longitude, c.center[0], c.center[1]) * 1000 <= c.radius;
  }
  const p = gf.coordinates as PolygonCoords;
  return pointInPolygon(pt.latitude, pt.longitude, p.points);
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Telemetry)   private teleRepo:  Repository<Telemetry>,
    @InjectRepository(Device)      private devRepo:   Repository<Device>,
    @InjectRepository(Vehicle)     private vehRepo:   Repository<Vehicle>,
    @InjectRepository(AlertLog)    private alRepo:    Repository<AlertLog>,
    @InjectRepository(Alert)       private alertRepo: Repository<Alert>,
    @InjectRepository(DriverEvent) private deRepo:    Repository<DriverEvent>,
    @InjectRepository(Geofence)    private gfRepo:    Repository<Geofence>,
    @InjectRepository(SavedReport) private savedRepo: Repository<SavedReport>,
  ) {}

  // ── Saved Reports ────────────────────────────────────────────────────────────

  async listSaved(userId: string, orgId: string | null): Promise<SavedReport[]> {
    if (orgId) return this.savedRepo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
    return this.savedRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async saveReport(dto: { title: string; type: string; params: Record<string, unknown> }, userId: string, userName: string, orgId: string | null): Promise<SavedReport> {
    return this.savedRepo.save(this.savedRepo.create({ title: dto.title, type: dto.type, params: dto.params, userId, userName, orgId }));
  }

  async deleteSaved(id: string, userId: string, orgId: string | null): Promise<void> {
    const r = await this.savedRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException();
    if (orgId ? r.orgId !== orgId : r.userId !== userId) throw new ForbiddenException();
    await this.savedRepo.remove(r);
  }

  async generate(p: ReportParams): Promise<ReportResult> {
    if (!p.vehicleIds.length) throw new BadRequestException('Select at least one vehicle');
    const diffDays = (p.to.getTime() - p.from.getTime()) / 86400000;
    if (diffDays > 31) throw new BadRequestException('Date range max 31 days');

    // Resolve vehicles + IMEIs — enforce org isolation for client users
    const vehicleWhere = p.organizationId
      ? { id: In(p.vehicleIds), organizationId: p.organizationId }
      : { id: In(p.vehicleIds) };
    const vehicles = await this.vehRepo.find({ where: vehicleWhere });
    const devices  = await this.devRepo.find({ where: { vehicle: { id: In(p.vehicleIds) } }, relations: { vehicle: true } });

    const vehMap = new Map(vehicles.map(v => [v.id, v]));
    const imeiToVeh = new Map<string, Vehicle>();
    const vehToImei = new Map<string, string>();
    for (const d of devices) {
      if (d.vehicle) { imeiToVeh.set(d.imei, d.vehicle); vehToImei.set(d.vehicle.id, d.imei); }
    }

    // Build ordered vehicle list (only those with a device)
    const vehList = vehicles.filter(v => vehToImei.has(v.id));
    const imeis = vehList.map(v => vehToImei.get(v.id)!);

    // Fetch telemetry
    let tele: Telemetry[] = [];
    if (imeis.length && p.type !== 'alert_history' && p.type !== 'driver_behavior') {
      tele = await this.teleRepo.createQueryBuilder('t')
        .where('t.imei IN (:...imeis)', { imeis })
        .andWhere('t.timestamp BETWEEN :from AND :to', { from: p.from, to: p.to })
        .andWhere('t.gps_valid = true')
        .orderBy('t.imei').addOrderBy('t.timestamp', 'ASC')
        .getMany();
    }

    // Group by IMEI
    const byImei = new Map<string, Telemetry[]>();
    for (const t of tele) {
      const arr = byImei.get(t.imei) ?? [];
      arr.push(t);
      byImei.set(t.imei, arr);
    }

    const meta = {
      type: p.type,
      from: fmtDt(p.from),
      to: fmtDt(p.to),
      generatedAt: fmtDt(new Date()),
      vehicleCount: vehList.length,
    };

    switch (p.type) {
      case 'travel_summary':    return { ...meta, ...this.travelSummary(vehList, vehToImei, byImei, p) };
      case 'stops_move_summary':return { ...meta, ...this.stopsMoveSum(vehList, vehToImei, byImei, p) };
      case 'stoppage_summary':  return { ...meta, ...this.stoppageSum(vehList, vehToImei, byImei, p) };
      case 'move_summary':      return { ...meta, ...this.moveSum(vehList, vehToImei, byImei) };
      case 'ignition_on_off':   return { ...meta, ...this.ignitionReport(vehList, vehToImei, byImei) };
      case 'overspeed':         return { ...meta, ...this.overspeedReport(vehList, vehToImei, byImei, p.speedLimit ?? 80) };
      case 'overspeed_summary': return { ...meta, ...this.overspeedSummary(vehList, vehToImei, byImei, p.speedLimit ?? 80) };
      case 'underspeed':        return { ...meta, ...this.underspeedReport(vehList, vehToImei, byImei, p.minSpeedKmh ?? 20) };
      case 'daily_travel':      return { ...meta, ...this.dailyTravel(vehList, vehToImei, byImei, p) };
      case 'vehicle_history':   return { ...meta, ...this.vehicleHistory(vehList, vehToImei, byImei) };
      case 'alert_history':     return { ...meta, ...(await this.alertHistory(vehList, vehToImei, p)) };
      case 'driver_behavior':   return { ...meta, ...(await this.driverBehaviorReport(vehList, p)) };
      case 'geofence_activity': return { ...meta, ...(await this.geofenceActivity(vehList, vehToImei, byImei, p.geofenceIds ?? [])) };
      default: throw new BadRequestException('Unknown report type');
    }
  }

  // ── 1. Travel Summary ──────────────────────────────────────────────────────
  private travelSummary(vehList: Vehicle[], vehToImei: Map<string,string>, byImei: Map<string,Telemetry[]>, p: ReportParams) {
    const columns = ['Vehicle', 'License Plate', 'Route Start', 'Route End', 'Route Length (km)', 'Move Duration', 'Stop Duration', 'Top Speed (km/h)', 'Avg Speed (km/h)', 'Overspeed Count', 'Engine Hours', 'Engine Work', 'Engine Idle'];
    const rows: (string|number|null)[][] = [];
    let totalDist = 0, totalMove = 0, totalStop = 0;

    for (const v of vehList) {
      const pts = byImei.get(vehToImei.get(v.id)!) ?? [];
      if (!pts.length) { rows.push([v.name, v.licensePlate, '—', '—', 0, '—', '—', 0, 0, 0, '—', '—', '—']); continue; }

      let dist = 0, moveMs = 0, engMs = 0, idleMs = 0, maxSpd = 0, sumSpd = 0, mc = 0, ovCt = 0;
      const lim = p.speedLimit ?? 80;

      for (let i = 1; i < pts.length; i++) {
        const dt = new Date(pts[i].timestamp).getTime() - new Date(pts[i-1].timestamp).getTime();
        dist += haversineKm(pts[i-1].latitude, pts[i-1].longitude, pts[i].latitude, pts[i].longitude);
        if (pts[i].speedKmh > maxSpd) maxSpd = pts[i].speedKmh;
        if (pts[i].speedKmh >= MOVING) { moveMs += dt; sumSpd += pts[i].speedKmh; mc++; }
        if (pts[i].ignition === true) { engMs += dt; if (pts[i].speedKmh < MOVING) idleMs += dt; }
        if (pts[i].speedKmh > lim) ovCt++;
      }

      const totalMs = new Date(pts[pts.length-1].timestamp).getTime() - new Date(pts[0].timestamp).getTime();
      totalDist += dist; totalMove += moveMs; totalStop += (totalMs - moveMs);

      rows.push([
        v.name, v.licensePlate,
        fmtDt(new Date(pts[0].timestamp)), fmtDt(new Date(pts[pts.length-1].timestamp)),
        +dist.toFixed(2), fmtMs(moveMs), fmtMs(totalMs - moveMs),
        +maxSpd.toFixed(1), mc ? +(sumSpd/mc).toFixed(1) : 0,
        ovCt, fmtMs(engMs), fmtMs(engMs - idleMs), fmtMs(idleMs),
      ]);
    }

    const summary: (string|number|null)[] = ['Total', '', '', '', +totalDist.toFixed(2), fmtMs(totalMove), fmtMs(totalStop), '', '', '', '', '', ''];
    return { columns, rows, rowCount: rows.length, summary };
  }

  // ── 2. Stops Move Summary ─────────────────────────────────────────────────
  private stopsMoveSum(vehList: Vehicle[], vehToImei: Map<string,string>, byImei: Map<string,Telemetry[]>, p: ReportParams) {
    const columns = ['Vehicle', 'License Plate', 'Type', 'Start Time', 'End Time', 'Duration', 'Distance (km)', 'Max Speed (km/h)', 'Avg Speed (km/h)', 'Location'];
    const rows: (string|number|null)[][] = [];
    const minMs = (p.minStopMin ?? 1) * 60 * 1000;

    for (const v of vehList) {
      const pts = byImei.get(vehToImei.get(v.id)!) ?? [];
      const segs = segment(pts);
      for (const s of segs) {
        if (s.type === 'stop' && s.ms < minMs) continue;
        const loc = s.type === 'stop' ? latLng(s.pts[0].latitude, s.pts[0].longitude) : '';
        rows.push([v.name, v.licensePlate, s.type === 'move' ? 'Move' : 'Stop', fmtDt(s.startTime), fmtDt(s.endTime), fmtMs(s.ms), s.type === 'move' ? +s.distKm.toFixed(2) : '', +s.maxSpd.toFixed(1), +s.avgSpd.toFixed(1), loc]);
      }
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── 3. Stoppage Summary ───────────────────────────────────────────────────
  private stoppageSum(vehList: Vehicle[], vehToImei: Map<string,string>, byImei: Map<string,Telemetry[]>, p: ReportParams) {
    const columns = ['Vehicle', 'License Plate', 'Stop Start', 'Stop End', 'Duration', 'Location'];
    const rows: (string|number|null)[][] = [];
    const minMs = (p.minStopMin ?? 1) * 60 * 1000;

    for (const v of vehList) {
      const pts = byImei.get(vehToImei.get(v.id)!) ?? [];
      const segs = segment(pts).filter(s => s.type === 'stop' && s.ms >= minMs);
      for (const s of segs) {
        rows.push([v.name, v.licensePlate, fmtDt(s.startTime), fmtDt(s.endTime), fmtMs(s.ms), latLng(s.pts[0].latitude, s.pts[0].longitude)]);
      }
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── 4. Move Summary ───────────────────────────────────────────────────────
  private moveSum(vehList: Vehicle[], vehToImei: Map<string,string>, byImei: Map<string,Telemetry[]>) {
    const columns = ['Vehicle', 'License Plate', 'Trip Start', 'Trip End', 'Duration', 'Distance (km)', 'Max Speed (km/h)', 'Avg Speed (km/h)'];
    const rows: (string|number|null)[][] = [];

    for (const v of vehList) {
      const pts = byImei.get(vehToImei.get(v.id)!) ?? [];
      for (const s of segment(pts).filter(s => s.type === 'move')) {
        rows.push([v.name, v.licensePlate, fmtDt(s.startTime), fmtDt(s.endTime), fmtMs(s.ms), +s.distKm.toFixed(2), +s.maxSpd.toFixed(1), +s.avgSpd.toFixed(1)]);
      }
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── 5. Ignition ON/OFF ────────────────────────────────────────────────────
  private ignitionReport(vehList: Vehicle[], vehToImei: Map<string,string>, byImei: Map<string,Telemetry[]>) {
    const columns = ['Vehicle', 'License Plate', 'Event', 'Time', 'Speed (km/h)', 'Location'];
    const rows: (string|number|null)[][] = [];

    for (const v of vehList) {
      const pts = byImei.get(vehToImei.get(v.id)!) ?? [];
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i-1].ignition, cur = pts[i].ignition;
        if (prev !== cur && cur !== null) {
          rows.push([v.name, v.licensePlate, cur ? 'Ignition ON' : 'Ignition OFF', fmtDt(new Date(pts[i].timestamp)), +pts[i].speedKmh.toFixed(1), latLng(pts[i].latitude, pts[i].longitude)]);
        }
      }
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── 6. Overspeed ──────────────────────────────────────────────────────────
  private overspeedReport(vehList: Vehicle[], vehToImei: Map<string,string>, byImei: Map<string,Telemetry[]>, lim: number) {
    const columns = ['Vehicle', 'License Plate', 'Start Time', 'End Time', 'Duration', 'Max Speed (km/h)', 'Speed Limit (km/h)', 'Start Location'];
    const rows: (string|number|null)[][] = [];

    for (const v of vehList) {
      const pts = byImei.get(vehToImei.get(v.id)!) ?? [];
      let inEvent = false, evStart = 0, maxSpd = 0, startPt: Telemetry | null = null;

      const flush = (end: Telemetry) => {
        if (!startPt) return;
        rows.push([v.name, v.licensePlate, fmtDt(new Date(evStart)), fmtDt(new Date(end.timestamp)), fmtMs(new Date(end.timestamp).getTime() - evStart), +maxSpd.toFixed(1), lim, latLng(startPt.latitude, startPt.longitude)]);
      };

      for (const pt of pts) {
        if (pt.speedKmh > lim) {
          if (!inEvent) { inEvent = true; evStart = new Date(pt.timestamp).getTime(); maxSpd = pt.speedKmh; startPt = pt; }
          else if (pt.speedKmh > maxSpd) maxSpd = pt.speedKmh;
        } else if (inEvent) { flush(pt); inEvent = false; maxSpd = 0; startPt = null; }
      }
      if (inEvent && pts.length) flush(pts[pts.length-1]);
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── 7. Overspeed Summary ──────────────────────────────────────────────────
  private overspeedSummary(vehList: Vehicle[], vehToImei: Map<string,string>, byImei: Map<string,Telemetry[]>, lim: number) {
    const columns = ['Vehicle', 'License Plate', 'Speed Limit (km/h)', 'Total Events', 'Total Duration', 'Max Speed (km/h)', 'Avg Speed in Events (km/h)'];
    const rows: (string|number|null)[][] = [];

    for (const v of vehList) {
      const pts = byImei.get(vehToImei.get(v.id)!) ?? [];
      let ct = 0, totalMs = 0, maxSpd = 0, sumSpd = 0, spdCt = 0;
      let inEv = false, evStart = 0;

      for (const pt of pts) {
        if (pt.speedKmh > lim) {
          if (!inEv) { inEv = true; evStart = new Date(pt.timestamp).getTime(); ct++; }
          if (pt.speedKmh > maxSpd) maxSpd = pt.speedKmh;
          sumSpd += pt.speedKmh; spdCt++;
        } else if (inEv) { totalMs += new Date(pt.timestamp).getTime() - evStart; inEv = false; }
      }
      rows.push([v.name, v.licensePlate, lim, ct, fmtMs(totalMs), +maxSpd.toFixed(1), spdCt ? +(sumSpd/spdCt).toFixed(1) : 0]);
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── 8. Underspeed ─────────────────────────────────────────────────────────
  private underspeedReport(vehList: Vehicle[], vehToImei: Map<string,string>, byImei: Map<string,Telemetry[]>, minSpd: number) {
    const columns = ['Vehicle', 'License Plate', 'Start Time', 'End Time', 'Duration', 'Min Speed (km/h)', 'Speed Threshold (km/h)', 'Location'];
    const rows: (string|number|null)[][] = [];

    for (const v of vehList) {
      const pts = byImei.get(vehToImei.get(v.id)!) ?? [];
      let inEv = false, evStart = 0, minSpd2 = 999, startPt: Telemetry | null = null;

      const flush = (end: Telemetry) => {
        if (!startPt) return;
        rows.push([v.name, v.licensePlate, fmtDt(new Date(evStart)), fmtDt(new Date(end.timestamp)), fmtMs(new Date(end.timestamp).getTime() - evStart), +minSpd2.toFixed(1), minSpd, latLng(startPt.latitude, startPt.longitude)]);
      };

      for (const pt of pts) {
        if (pt.speedKmh >= MOVING && pt.speedKmh < minSpd) {
          if (!inEv) { inEv = true; evStart = new Date(pt.timestamp).getTime(); minSpd2 = pt.speedKmh; startPt = pt; }
          else if (pt.speedKmh < minSpd2) minSpd2 = pt.speedKmh;
        } else if (inEv) { flush(pt); inEv = false; minSpd2 = 999; startPt = null; }
      }
      if (inEv && pts.length) flush(pts[pts.length-1]);
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── 9. Daily Travel ───────────────────────────────────────────────────────
  private dailyTravel(vehList: Vehicle[], vehToImei: Map<string,string>, byImei: Map<string,Telemetry[]>, p: ReportParams) {
    const columns = ['Vehicle', 'License Plate', 'Date', 'Distance (km)', 'Move Duration', 'Stop Duration', 'Top Speed (km/h)', 'Avg Speed (km/h)', 'Trips', 'Overspeed Count'];
    const rows: (string|number|null)[][] = [];
    const lim = p.speedLimit ?? 80;

    for (const v of vehList) {
      const pts = byImei.get(vehToImei.get(v.id)!) ?? [];
      const byDay = new Map<string, Telemetry[]>();
      for (const pt of pts) {
        const d = fmtDate(new Date(pt.timestamp));
        const arr = byDay.get(d) ?? []; arr.push(pt); byDay.set(d, arr);
      }
      for (const [day, dpts] of byDay) {
        let dist = 0, moveMs = 0, maxSpd = 0, sumSpd = 0, mc = 0, ovCt = 0, trips = 0;
        let wasMoving = false;
        for (let i = 1; i < dpts.length; i++) {
          const dt = new Date(dpts[i].timestamp).getTime() - new Date(dpts[i-1].timestamp).getTime();
          dist += haversineKm(dpts[i-1].latitude, dpts[i-1].longitude, dpts[i].latitude, dpts[i].longitude);
          if (dpts[i].speedKmh > maxSpd) maxSpd = dpts[i].speedKmh;
          if (dpts[i].speedKmh >= MOVING) { moveMs += dt; sumSpd += dpts[i].speedKmh; mc++; if (!wasMoving) { trips++; wasMoving = true; } }
          else wasMoving = false;
          if (dpts[i].speedKmh > lim) ovCt++;
        }
        const totalMs = new Date(dpts[dpts.length-1].timestamp).getTime() - new Date(dpts[0].timestamp).getTime();
        rows.push([v.name, v.licensePlate, day, +dist.toFixed(2), fmtMs(moveMs), fmtMs(totalMs - moveMs), +maxSpd.toFixed(1), mc ? +(sumSpd/mc).toFixed(1) : 0, trips, ovCt]);
      }
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── 10. Vehicle History ───────────────────────────────────────────────────
  private vehicleHistory(vehList: Vehicle[], vehToImei: Map<string,string>, byImei: Map<string,Telemetry[]>) {
    const columns = ['Vehicle', 'License Plate', 'Time', 'Latitude', 'Longitude', 'Speed (km/h)', 'Heading', 'Ignition', 'Satellites', 'Signal'];
    const rows: (string|number|null)[][] = [];

    for (const v of vehList) {
      const pts = byImei.get(vehToImei.get(v.id)!) ?? [];
      for (const pt of pts) {
        rows.push([v.name, v.licensePlate, fmtDt(new Date(pt.timestamp)), +pt.latitude.toFixed(6), +pt.longitude.toFixed(6), +pt.speedKmh.toFixed(1), pt.heading, pt.ignition ? 'ON' : 'OFF', pt.satellites, pt.gsmSignal ?? '']);
      }
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── 11. Alert History ─────────────────────────────────────────────────────
  private async alertHistory(vehList: Vehicle[], vehToImei: Map<string,string>, p: ReportParams) {
    const columns = ['Vehicle', 'License Plate', 'Alert Name', 'Alert Type', 'Triggered At', 'Speed (km/h)', 'Location'];
    const rows: (string|number|null)[][] = [];

    const imeis = vehList.map(v => vehToImei.get(v.id)!).filter(Boolean);
    if (!imeis.length) return { columns, rows, rowCount: 0, summary: null };

    const logs = await this.alRepo.createQueryBuilder('al')
      .where('al.imei IN (:...imeis)', { imeis })
      .andWhere('al.triggered_at BETWEEN :from AND :to', { from: p.from, to: p.to })
      .orderBy('al.triggered_at', 'ASC')
      .getMany();

    const alertIds = [...new Set(logs.map(l => l.alertId))];
    const alerts = alertIds.length ? await this.alertRepo.find({ where: { id: In(alertIds) } }) : [];
    const alertMap = new Map(alerts.map(a => [a.id, a]));
    const imeiToVeh = new Map(vehList.map(v => [vehToImei.get(v.id)!, v]));

    for (const log of logs) {
      const v = imeiToVeh.get(log.imei);
      const al = alertMap.get(log.alertId);
      const spd = (log.payload as any)?.speed ?? '';
      const lat = (log.payload as any)?.lat, lng = (log.payload as any)?.lng;
      const loc = lat && lng ? latLng(lat, lng) : '';
      rows.push([v?.name ?? log.imei, v?.licensePlate ?? '', al?.name ?? '—', al?.type ?? '—', fmtDt(new Date(log.triggeredAt)), spd ? +Number(spd).toFixed(1) : '', loc]);
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── 12. Driver Behavior ───────────────────────────────────────────────────
  private async driverBehaviorReport(vehList: Vehicle[], p: ReportParams) {
    const columns = ['Vehicle', 'License Plate', 'Harsh Brakes', 'Rapid Accels', 'Sharp Turns', 'Overspeed Events', 'Total Events', 'Worst Severity'];
    const rows: (string|number|null)[][] = [];

    const vehIds = vehList.map(v => v.id);
    const events = await this.deRepo.createQueryBuilder('de')
      .where('de.vehicle_id IN (:...vehIds)', { vehIds })
      .andWhere('de.timestamp BETWEEN :from AND :to', { from: p.from, to: p.to })
      .getMany();

    const byVeh = new Map<string, DriverEvent[]>();
    for (const e of events) { const arr = byVeh.get(e.vehicleId) ?? []; arr.push(e); byVeh.set(e.vehicleId, arr); }

    for (const v of vehList) {
      const evs = byVeh.get(v.id) ?? [];
      const hb = evs.filter(e => e.type === 'harsh_brake').length;
      const ra = evs.filter(e => e.type === 'rapid_accel').length;
      const st = evs.filter(e => e.type === 'sharp_turn').length;
      const os = evs.filter(e => e.type === 'overspeed').length;
      const worst = evs.some(e => e.severity === 'high') ? 'High' : evs.some(e => e.severity === 'medium') ? 'Medium' : evs.length ? 'Low' : '—';
      rows.push([v.name, v.licensePlate, hb, ra, st, os, evs.length, worst]);
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── 13. Geofence Activity ─────────────────────────────────────────────────
  private async geofenceActivity(vehList: Vehicle[], vehToImei: Map<string,string>, byImei: Map<string,Telemetry[]>, gfIds: string[]) {
    const columns = ['Vehicle', 'License Plate', 'Geofence', 'Event', 'Time', 'Duration Inside', 'Speed (km/h)', 'Location'];
    const rows: (string|number|null)[][] = [];

    const geofences = gfIds.length ? await this.gfRepo.find({ where: { id: In(gfIds) } }) : await this.gfRepo.find();
    if (!geofences.length) return { columns, rows, rowCount: 0, summary: null };

    for (const v of vehList) {
      const pts = byImei.get(vehToImei.get(v.id)!) ?? [];
      for (const gf of geofences) {
        let inside = false, enterTime = 0, enterPt: Telemetry | null = null;
        for (const pt of pts) {
          const cur = inGeofence(pt, gf);
          if (cur && !inside) {
            inside = true; enterTime = new Date(pt.timestamp).getTime(); enterPt = pt;
            rows.push([v.name, v.licensePlate, gf.name, 'Enter', fmtDt(new Date(pt.timestamp)), '—', +pt.speedKmh.toFixed(1), latLng(pt.latitude, pt.longitude)]);
          } else if (!cur && inside) {
            inside = false;
            const dur = new Date(pt.timestamp).getTime() - enterTime;
            rows.push([v.name, v.licensePlate, gf.name, 'Exit', fmtDt(new Date(pt.timestamp)), fmtMs(dur), +pt.speedKmh.toFixed(1), latLng(pt.latitude, pt.longitude)]);
            // Update the Enter row with duration — find it and replace
            const eRow = [...rows].reverse().find((r: (string|number|null)[]) => r[0] === v.name && r[2] === gf.name && r[3] === 'Enter');
            if (eRow) eRow[5] = fmtMs(dur);
          }
        }
      }
    }
    return { columns, rows, rowCount: rows.length, summary: null };
  }

  // ── CSV Export ─────────────────────────────────────────────────────────────
  toCsv(result: ReportResult): string {
    const escape = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [result.columns.map(escape).join(',')];
    for (const row of result.rows) lines.push(row.map(escape).join(','));
    if (result.summary) lines.push(result.summary.map(escape).join(','));
    return lines.join('\n');
  }
}
