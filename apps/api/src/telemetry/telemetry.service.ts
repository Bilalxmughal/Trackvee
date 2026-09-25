import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { Telemetry } from './entities/telemetry.entity.js';
import { DevicesService } from '../devices/devices.service.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { GeofencesService } from '../geofences/geofences.service.js';
import { DriverBehaviorService } from '../driver-behavior/driver-behavior.service.js';
import type { CircleCoords, PolygonCoords } from '../geofences/entities/geofence.entity.js';
import { SpeedZonesService } from '../speed-zones/speed-zones.service.js';
import type { SZCircleCoords, SZPolygonCoords } from '../speed-zones/entities/speed-zone.entity.js';
import { User } from '../users/entities/user.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

// Geospatial helpers
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function pointInPolygon(lat: number, lng: number, points: [number,number][]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [yi, xi] = points[i], [yj, xj] = points[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function isScheduleActive(schedule: { from?: string; to?: string; days?: string[]; timeFrom?: string; timeTo?: string } | null): boolean {
  if (!schedule) return true;
  const now = new Date();
  if (schedule.from && now < new Date(schedule.from)) return false;
  if (schedule.to && now > new Date(schedule.to)) return false;
  if (schedule.days && schedule.days.length > 0) {
    const dayNames = ['sun','mon','tue','wed','thu','fri','sat'];
    if (!schedule.days.includes(dayNames[now.getDay()])) return false;
  }
  if (schedule.timeFrom || schedule.timeTo) {
    const hhmm = now.getHours() * 100 + now.getMinutes();
    const parse = (t: string) => { const [h,m] = t.split(':').map(Number); return h*100+(m||0); };
    if (schedule.timeFrom && hhmm < parse(schedule.timeFrom)) return false;
    if (schedule.timeTo && hhmm > parse(schedule.timeTo)) return false;
  }
  return true;
}

// Cooldown map to avoid duplicate logs (alertId+imei → last triggered ms)
const triggerCooldown = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class TelemetryService {
  constructor(
    @InjectRepository(Telemetry)
    private repo: Repository<Telemetry>,
    private devicesService: DevicesService,
    private alertsService: AlertsService,
    private geofencesService: GeofencesService,
    private driverBehaviorService: DriverBehaviorService,
    private speedZonesService: SpeedZonesService,
  ) {}

  async findRecent(user: User, limit = 100): Promise<Telemetry[]> {
    if (ADMIN_ROLES.includes(user.role)) {
      return this.repo.find({ order: { timestamp: 'DESC' }, take: limit });
    }
    if (user.organizationId) {
      const devices = await this.devicesService.findAll(user);
      const imeis = devices.map(d => d.imei);
      if (!imeis.length) return [];
      return this.repo.find({ where: { imei: In(imeis) }, order: { timestamp: 'DESC' }, take: limit });
    }
    return [];
  }

  async save(data: Partial<Telemetry>): Promise<Telemetry> {
    const record = this.repo.create(data);
    const saved = await this.repo.save(record);
    // Fire-and-forget alert + driver behavior evaluation
    this.evaluateAlerts(saved).catch(() => {});
    this.evaluateDriverBehavior(saved).catch(() => {});
    return saved;
  }

  private async evaluateDriverBehavior(pt: Telemetry): Promise<void> {
    if (!pt.gpsValid) return;
    const device = await this.devicesService.findByImei(pt.imei).catch(() => null);
    if (!device?.vehicleId) return;
    const prevRows = await this.repo.find({
      where: { imei: pt.imei },
      order: { timestamp: 'DESC' },
      skip: 1,
      take: 1,
    });
    await this.driverBehaviorService.processForDriverBehavior(pt, prevRows[0] ?? null, device);
  }

  private async evaluateAlerts(pt: Telemetry): Promise<void> {
    const device = await this.devicesService.findByImei(pt.imei).catch(() => null);
    const orgId = device ? (device as any).organizationId ?? null : null;
    const alerts = await this.alertsService.findActiveForImei(pt.imei, orgId);
    if (!alerts.length) return;

    const prevRows = await this.repo.find({ where: { imei: pt.imei }, order: { timestamp: 'DESC' }, skip: 1, take: 2 });
    const prev = prevRows[0] ?? null;
    const prev2 = prevRows[1] ?? null;
    const MOVING = 5;
    const TOW_SPEED = 15;

    for (const alert of alerts) {
      if (!isScheduleActive(alert.schedule)) continue;
      const key = `${alert.id}:${pt.imei}`;
      const lastTriggered = triggerCooldown.get(key) ?? 0;
      if (Date.now() - lastTriggered < COOLDOWN_MS) continue;

      let triggered = false;
      const payload: Record<string, unknown> = { speed: pt.speedKmh, lat: pt.latitude, lng: pt.longitude, ts: pt.timestamp };

      switch (alert.type) {
        case 'over_speed':
          triggered = pt.speedKmh >= (alert.config.speedLimit ?? 80);
          break;
        case 'idle':
          triggered = pt.ignition === true && pt.speedKmh < MOVING;
          // Idle needs sustained duration — simplified: trigger once per cooldown window when idle
          break;
        case 'ignition_on':
          triggered = pt.ignition === true && prev?.ignition !== true;
          break;
        case 'ignition_off':
          triggered = pt.ignition === false && prev?.ignition !== false;
          break;
        case 'power_cut':
          triggered = pt.externalPower === false && prev?.externalPower !== false;
          break;
        case 'low_battery':
          triggered = pt.voltageLevel != null && pt.voltageLevel <= (alert.config.level ?? 1);
          break;
        case 'no_gps':
          triggered = !pt.gpsValid;
          break;
        case 'offline':
          // Offline is evaluated by absence of data — skip here (checked separately)
          break;
        case 'tow':
          // Require 2 consecutive packets: ignition off + speed >= 15 km/h to avoid GPS noise false positives
          triggered = pt.ignition !== true && pt.speedKmh >= TOW_SPEED
            && prev !== null && prev.ignition !== true && prev.speedKmh >= TOW_SPEED
            && (prev2 === null || (prev2.ignition !== true && prev2.speedKmh >= TOW_SPEED));
          break;
        case 'speed_zone': {
          if (!alert.config.geofenceId) break;
          const geofences = await this.geofencesService.findAll({ organizationId: orgId } as any).catch(() => []);
          const gf = geofences.find(g => g.id === alert.config.geofenceId);
          if (!gf) break;
          let inZone = false;
          if (gf.type === 'circle') {
            const c = gf.coordinates as CircleCoords;
            inZone = haversineKm(pt.latitude, pt.longitude, c.center[0], c.center[1]) * 1000 <= c.radius;
          } else {
            const p = gf.coordinates as PolygonCoords;
            inZone = pointInPolygon(pt.latitude, pt.longitude, p.points);
          }
          triggered = inZone && pt.speedKmh > (alert.config.speedLimit ?? 60);
          payload['geofenceId'] = gf.id;
          payload['geofenceName'] = gf.name;
          payload['speedLimit'] = alert.config.speedLimit ?? 60;
          break;
        }
        case 'over_parking':
          // Simplified: trigger if parked (ignition off, speed < threshold) once per cooldown
          triggered = pt.ignition !== true && pt.speedKmh < MOVING;
          break;
        case 'geofence': {
          if (!alert.config.geofenceId) break;
          const geofences = await this.geofencesService.findAll({ organizationId: orgId } as any).catch(() => []);
          const gf = geofences.find(g => g.id === alert.config.geofenceId);
          if (!gf) break;

          let inside = false;
          if (gf.type === 'circle') {
            const c = gf.coordinates as CircleCoords;
            inside = haversineKm(pt.latitude, pt.longitude, c.center[0], c.center[1]) * 1000 <= c.radius;
          } else {
            const p = gf.coordinates as PolygonCoords;
            inside = pointInPolygon(pt.latitude, pt.longitude, p.points);
          }
          let prevInside = false;
          if (prev) {
            if (gf.type === 'circle') {
              const c = gf.coordinates as CircleCoords;
              prevInside = haversineKm(prev.latitude, prev.longitude, c.center[0], c.center[1]) * 1000 <= c.radius;
            } else {
              const p = gf.coordinates as PolygonCoords;
              prevInside = pointInPolygon(prev.latitude, prev.longitude, p.points);
            }
          }
          const event = alert.config.geofenceEvent ?? 'both';
          if (event === 'enter') triggered = inside && !prevInside;
          else if (event === 'exit') triggered = !inside && prevInside;
          else triggered = inside !== prevInside;
          payload['geofenceId'] = gf.id;
          payload['geofenceName'] = gf.name;
          payload['event'] = inside ? 'enter' : 'exit';
          break;
        }
      }

      if (triggered) {
        triggerCooldown.set(key, Date.now());
        await this.alertsService.logTrigger(alert.id, pt.imei, payload);
      }
    }
  }

  async getLatest(imei: string): Promise<Telemetry | null> {
    return this.repo.findOne({
      where: { imei },
      order: { timestamp: 'DESC' },
    });
  }

  async getHistory(imei: string, opts: { limit?: number; from?: string; to?: string } = {}): Promise<Telemetry[]> {
    const where: Record<string, unknown> = { imei };
    if (opts.from || opts.to) {
      const start = opts.from ? new Date(opts.from) : new Date(0);
      const end   = opts.to   ? new Date(opts.to)   : new Date();
      where['timestamp'] = Between(start, end);
    }
    return this.repo.find({
      where: where as any,
      order: { timestamp: 'ASC' },
      take: opts.limit ?? 2000,
    });
  }

  async getVehicleStats(imei: string): Promise<{
    stopDuration: number | null;
    odometer: number;
    engineHours: number;
  }> {
    const latest = await this.repo.findOne({ where: { imei }, order: { timestamp: 'DESC' } });

    // Stop duration: time since last genuine movement (speed >= 5 km/h)
    // Using 5 km/h threshold to filter GPS noise which commonly reads 1-3 km/h even when stopped
    const MOVING_KMH = 5;
    let stopDuration: number | null = null;
    if (latest && latest.speedKmh < MOVING_KMH) {
      const lastMoving = await this.repo.findOne({
        where: { imei, speedKmh: MoreThanOrEqual(MOVING_KMH) },
        order: { timestamp: 'DESC' },
      });
      if (lastMoving) {
        stopDuration = Math.floor((Date.now() - new Date(lastMoving.timestamp).getTime()) / 1000);
      }
    }

    // Odometer: haversine sum of all valid GPS points (last 90 days)
    const odomResult = await this.repo.query<{ total_km: string }[]>(`
      WITH ordered AS (
        SELECT latitude, longitude,
               LAG(latitude)  OVER (ORDER BY timestamp) AS prev_lat,
               LAG(longitude) OVER (ORDER BY timestamp) AS prev_lng
        FROM telemetry
        WHERE imei = $1 AND gps_valid = true
          AND timestamp > NOW() - INTERVAL '90 days'
      )
      SELECT COALESCE(SUM(
        6371 * 2 * ASIN(LEAST(1.0, SQRT(
          POWER(SIN((RADIANS(latitude) - RADIANS(prev_lat)) / 2), 2) +
          COS(RADIANS(prev_lat)) * COS(RADIANS(latitude)) *
          POWER(SIN((RADIANS(longitude) - RADIANS(prev_lng)) / 2), 2)
        )))
      ), 0) AS total_km
      FROM ordered
      WHERE prev_lat IS NOT NULL
    `, [imei]);
    const odometer = parseFloat(odomResult[0]?.total_km ?? '0');

    // Engine hours: sum of consecutive ignition=true intervals under 10 min
    const engResult = await this.repo.query<{ engine_seconds: string }[]>(`
      WITH runs AS (
        SELECT timestamp, ignition,
               LEAD(timestamp) OVER (ORDER BY timestamp) AS next_ts,
               LEAD(ignition)  OVER (ORDER BY timestamp) AS next_ignition
        FROM telemetry
        WHERE imei = $1
          AND timestamp > NOW() - INTERVAL '90 days'
      )
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (next_ts - timestamp))), 0) AS engine_seconds
      FROM runs
      WHERE ignition = true AND next_ignition = true
        AND EXTRACT(EPOCH FROM (next_ts - timestamp)) < 600
    `, [imei]);
    const engineHours = parseFloat(engResult[0]?.engine_seconds ?? '0') / 3600;

    return { stopDuration, odometer, engineHours };
  }

  async getLiveLocations(user: User): Promise<Telemetry[]> {
    let imeis: string[] | null = null;

    if (!ADMIN_ROLES.includes(user.role) && user.organizationId) {
      const devices = await this.devicesService.findAll(user);
      imeis = devices.map(d => d.imei);
      if (!imeis.length) return [];
    }

    const sub = this.repo
      .createQueryBuilder('t')
      .select('t.imei', 'imei')
      .addSelect('MAX(t.timestamp)', 'max_ts')
      .groupBy('t.imei');

    if (imeis) sub.where('t.imei IN (:...imeis)', { imeis });

    const rows = await sub.getRawMany<{ imei: string; max_ts: string }>();
    if (!rows.length) return [];

    const results = await Promise.all(
      rows.map(r => this.repo.findOne({ where: { imei: r.imei, timestamp: new Date(r.max_ts) } }))
    );
    return results.filter((r): r is Telemetry => r !== null);
  }
}
