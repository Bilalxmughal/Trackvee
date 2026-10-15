import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, MoreThan, Repository } from 'typeorm';
import { Telemetry } from './entities/telemetry.entity.js';
import { DevicesService } from '../devices/devices.service.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { GeofencesService } from '../geofences/geofences.service.js';
import { DriverBehaviorService } from '../driver-behavior/driver-behavior.service.js';
import type { CircleCoords, PolygonCoords } from '../geofences/entities/geofence.entity.js';
import { SpeedZonesService } from '../speed-zones/speed-zones.service.js';
import type { SZCircleCoords, SZPolygonCoords } from '../speed-zones/entities/speed-zone.entity.js';
import { MaintenanceService } from '../maintenance/maintenance.service.js';
import { User } from '../users/entities/user.entity.js';
import { resolveVehicleLiveStatus, type VehicleLiveStatus, type VehicleMotionSample } from './vehicle-state.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];
const DEVICE_ONLINE_MS = 2 * 60 * 1000;
const DEVICE_OFFLINE_MS = 10 * 60 * 1000;
const GPS_STALE_MS = 10 * 60 * 1000;
const VOLTAGE_LABELS = ['No Power', 'Critical', 'Low', 'Medium', 'High', 'Full'];

export interface DeviceHealthRow {
  deviceId: string;
  imei: string;
  deviceName: string | null;
  vehicle: { id: string; displayId: number; licensePlate: string | null; name: string } | null;
  connection: 'online' | 'delayed' | 'offline' | 'never_seen';
  lastPacketAt: Date | null;
  lastGpsAt: Date | null;
  lastGpsReceivedAt: Date | null;
  trackerLagSeconds: number | null;
  gps: 'good' | 'weak' | 'no_fix' | 'stale' | 'unknown';
  satellites: number | null;
  gsm: 'good' | 'fair' | 'weak' | 'unknown';
  gsmSignal: number | null;
  externalPower: 'connected' | 'disconnected' | 'unknown';
  voltageLevel: string | null;
  ignition: boolean | null;
  issues: string[];
}

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
    private maintenanceService: MaintenanceService,
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
        case 'maintenance': {
          if (!device?.vehicleId || !orgId || !alert.config.serviceType || !pt.gpsValid) break;
          const serviceType = alert.config.serviceType === 'Other' && alert.config.customServiceType ? alert.config.customServiceType : alert.config.serviceType;
          if (!serviceType) break;
          const due = await this.maintenanceService.getAlertState(device.vehicleId, orgId, serviceType);
          if (!due) break;
          payload['maintenanceRecordId'] = due.recordId;
          payload['serviceType'] = serviceType;
          payload['maintenanceStatus'] = due.status;
          payload['nextDueDate'] = due.dueDate;
          payload['nextDueOdometerKm'] = due.dueOdometerKm;
          triggered = !(await this.alertsService.hasMaintenanceTrigger(alert.id, pt.imei, due.recordId));
          break;
        }
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

  async getHistory(imei: string, opts: { limit?: number; offset?: number; from?: string; to?: string } = {}): Promise<Telemetry[]> {
    const where: Record<string, unknown> = { imei };
    if (opts.from || opts.to) {
      const start = opts.from ? new Date(opts.from) : new Date(0);
      const end   = opts.to   ? new Date(opts.to)   : new Date();
      where['timestamp'] = Between(start, end);
    }
    return this.repo.find({
      where: where as any,
      order: { timestamp: 'ASC', id: 'ASC' },
      skip: Math.max(0, opts.offset ?? 0),
      take: opts.limit ?? 2000,
    });
  }

  async getVehicleStats(imei: string): Promise<{
    stopDuration: number | null;
    odometer: number;
    engineHours: number;
  }> {
    const [latest, device] = await Promise.all([
      this.repo.findOne({ where: { imei, gpsValid: true }, order: { timestamp: 'DESC' } }),
      this.devicesService.findByImei(imei),
    ]);
    let stopDuration: number | null = null;
    const now = Date.now();
    const latestAge = latest ? now - new Date(latest.timestamp).getTime() : null;
    const latestIsFresh = latestAge !== null && latestAge <= 90 * 60_000;
    // Device is alive if a packet (including heartbeat) arrived within the last 10 minutes
    const deviceAlive = device?.lastSeenAt != null && now - new Date(device.lastSeenAt).getTime() <= 10 * 60_000;

    if (latestIsFresh && latest && latest.speedKmh <= 2) {
      // GPS-based path: recent stationary GPS packet — use segment logic
      const stationaryRun = await this.repo.query<{ stop_started_at: Date | string | null; sample_count: string }[]>(`
        WITH last_moving AS (
          (
          SELECT timestamp
          FROM telemetry
          WHERE imei = $1 AND gps_valid = true AND speed_kmh > 2
          ORDER BY timestamp DESC
          LIMIT 1
          )
          UNION ALL
          SELECT MIN(timestamp) - INTERVAL '1 microsecond' AS timestamp
          FROM telemetry
          WHERE imei = $1 AND gps_valid = true
          HAVING NOT EXISTS (
            SELECT 1 FROM telemetry
            WHERE imei = $1 AND gps_valid = true AND speed_kmh > 2
          )
        ), stationary_points AS (
          SELECT t.timestamp,
            LAG(t.timestamp) OVER (ORDER BY t.timestamp) AS previous_timestamp
          FROM telemetry t
          CROSS JOIN last_moving m
          WHERE t.imei = $1 AND t.gps_valid = true AND t.speed_kmh <= 2
            AND t.timestamp > m.timestamp
        ), stationary_segments AS (
          SELECT timestamp,
            SUM(CASE WHEN previous_timestamp IS NULL
                       OR timestamp - previous_timestamp > INTERVAL '60 minutes'
                     THEN 1 ELSE 0 END) OVER (ORDER BY timestamp) AS segment_id
          FROM stationary_points
        ), latest_segment AS (
          SELECT segment_id FROM stationary_segments ORDER BY timestamp DESC LIMIT 1
        )
        SELECT MIN(timestamp) AS stop_started_at, COUNT(*)::text AS sample_count
        FROM stationary_segments
        WHERE segment_id = (SELECT segment_id FROM latest_segment)
      `, [imei]);
      const run = stationaryRun[0];
      if (run?.stop_started_at && Number(run.sample_count) >= 2) {
        stopDuration = Math.max(0, Math.floor((now - new Date(run.stop_started_at).getTime()) / 1000));
      }
    } else if (deviceAlive && latest && latestAge !== null && latestAge > 5 * 60_000) {
      // Heartbeat-only path: tracker is alive (recent heartbeat) but no GPS for > 5 min.
      // This means the vehicle is parked and the tracker stopped sending GPS packets.
      // Stop started at the last GPS timestamp.
      stopDuration = Math.max(0, Math.floor(latestAge / 1000));
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

  async getLiveLocations(user: User): Promise<Array<Telemetry & { vehicleStatus: VehicleLiveStatus }>> {
    // Live endpoints include only trackers attached to active vehicles. Expired
    // vehicles remain available through history and reports, but not live maps.
    const assignedDevices = await this.devicesService.findAll(user);
    const imeis: string[] = assignedDevices
      .filter(device => device.vehicleId && device.vehicle?.lifecycleStatus === 'active' && (!device.vehicle.expiresAt || new Date(device.vehicle.expiresAt).getTime() > Date.now()))
      .map(device => device.imei);
    if (!imeis.length) return [];

    // Single DISTINCT ON query avoids the MAX+findOne two-query race where two packets
    // with the same device timestamp could cause findOne to match the wrong row.
    const results = await this.repo
      .createQueryBuilder('t')
      .where('t.imei IN (:...imeis)', { imeis })
      .distinctOn(['t.imei'])
      .orderBy('t.imei', 'ASC')
      .addOrderBy('t.timestamp', 'DESC')
      .addOrderBy('t.createdAt', 'DESC')
      .getMany();
    if (!results.length) return [];

    // Only query status samples for devices already authorized above.
    const statusRows = await this.repo.query<Array<{
      imei: string; timestamp: Date | string; latitude: number; longitude: number;
      speed_kmh: number; ignition: boolean | null;
    }>>(`
      SELECT live.imei, sample.timestamp, sample.latitude, sample.longitude, sample.speed_kmh, sample.ignition
      FROM unnest($1::varchar[]) AS live(imei)
      CROSS JOIN LATERAL (
        SELECT timestamp, latitude, longitude, speed_kmh, ignition
        FROM telemetry
        WHERE imei = live.imei AND gps_valid = true
        ORDER BY timestamp DESC
        LIMIT 3
      ) AS sample
      ORDER BY live.imei, sample.timestamp DESC
    `, [results.map(point => point.imei)]);

    const samplesByImei = new Map<string, VehicleMotionSample[]>();
    for (const row of statusRows) {
      const samples = samplesByImei.get(row.imei) ?? [];
      samples.push({ timestamp: row.timestamp, latitude: Number(row.latitude), longitude: Number(row.longitude), speedKmh: Number(row.speed_kmh), ignition: row.ignition });
      samplesByImei.set(row.imei, samples);
    }

    return results.map(point => ({ ...point, vehicleStatus: resolveVehicleLiveStatus(samplesByImei.get(point.imei) ?? []) }));
  }

  async getDeviceHealth(user: User, cityId?: string): Promise<DeviceHealthRow[]> {
    const devices = await this.devicesService.findAll(user, cityId);
    if (!devices.length) return [];

    const imeis = devices.map(device => device.imei);
    const latestRows = await this.repo.query<Array<{
      imei: string; timestamp: Date | string; gps_valid: boolean; satellites: number;
      gsm_signal: number | null; voltage_level: number | null; external_power: boolean | null;
      ignition: boolean | null; created_at: Date | string;
    }>>(`
      SELECT DISTINCT ON (imei)
        imei, timestamp, gps_valid, satellites, gsm_signal, voltage_level, external_power, ignition, created_at
      FROM telemetry
      WHERE imei = ANY($1::varchar[])
      ORDER BY imei, timestamp DESC
    `, [imeis]);
    const latestByImei = new Map(latestRows.map(row => [row.imei, row]));
    const now = Date.now();

    return devices.map(device => {
      const latest = latestByImei.get(device.imei);
      const lastPacketAt = device.lastSeenAt;
      const lastGpsAt = latest ? new Date(latest.timestamp) : null;
      const lastGpsReceivedAt = latest ? new Date(latest.created_at) : null;
      const trackerLagSeconds = latest && lastGpsReceivedAt && lastGpsAt
        ? Math.round((lastGpsReceivedAt.getTime() - lastGpsAt.getTime()) / 1000) : null;
      const packetAge = lastPacketAt ? Math.max(0, now - new Date(lastPacketAt).getTime()) : null;
      const gpsAge = lastGpsReceivedAt ? Math.max(0, now - lastGpsReceivedAt.getTime()) : null;
      const connection: DeviceHealthRow['connection'] = packetAge == null ? 'never_seen'
        : packetAge <= DEVICE_ONLINE_MS ? 'online'
        : packetAge <= DEVICE_OFFLINE_MS ? 'delayed' : 'offline';
      const gps: DeviceHealthRow['gps'] = !latest ? 'unknown'
        : gpsAge != null && gpsAge > GPS_STALE_MS ? 'stale'
        : !latest.gps_valid ? 'no_fix'
        : Number(latest.satellites) < 4 ? 'weak' : 'good';
      const gsmSignal = latest?.gsm_signal ?? device.lastGsmSignal;
      const gsm: DeviceHealthRow['gsm'] = gsmSignal == null ? 'unknown'
        : gsmSignal <= 1 ? 'weak' : gsmSignal <= 3 ? 'fair' : 'good';
      const externalPowerValue = latest?.external_power ?? device.lastExternalPower;
      const externalPower: DeviceHealthRow['externalPower'] = externalPowerValue == null ? 'unknown'
        : externalPowerValue ? 'connected' : 'disconnected';
      const voltageValue = latest?.voltage_level ?? device.lastVoltageLevel;
      const voltageLevel = voltageValue == null ? null : (VOLTAGE_LABELS[voltageValue] ?? `Level ${voltageValue}`);
      const issues: string[] = [];

      if (connection === 'never_seen') issues.push('Never connected');
      else if (connection === 'offline') issues.push('No recent packets');
      else if (connection === 'delayed') issues.push('Packets delayed');
      if (gps === 'stale') issues.push('GPS data stale');
      else if (gps === 'no_fix') issues.push('No GPS fix');
      else if (gps === 'weak') issues.push('Weak GPS fix');
      if (gsm === 'weak') issues.push('Weak GSM signal');
      if (externalPower === 'disconnected') issues.push('External power off');
      if (voltageValue != null && voltageValue <= 1) issues.push('Critical tracker voltage');
      if (trackerLagSeconds != null && trackerLagSeconds > 120) issues.push(`Tracker timestamp is ${Math.round(trackerLagSeconds / 60)} min behind receipt`);

      return {
        deviceId: device.id,
        imei: device.imei,
        deviceName: device.name,
        vehicle: device.vehicle ? {
          id: device.vehicle.id,
          displayId: device.vehicle.displayId,
          licensePlate: device.vehicle.licensePlate,
          name: device.vehicle.name,
        } : null,
        connection,
        lastPacketAt,
        lastGpsAt,
        lastGpsReceivedAt,
        trackerLagSeconds,
        gps,
        satellites: latest ? Number(latest.satellites) : null,
        gsm,
        gsmSignal,
        externalPower,
        voltageLevel,
        ignition: latest?.ignition ?? device.lastIgnition,
        issues,
      };
    });
  }
}
