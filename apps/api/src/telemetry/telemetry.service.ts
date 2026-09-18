import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { Telemetry } from './entities/telemetry.entity.js';
import { DevicesService } from '../devices/devices.service.js';
import { User } from '../users/entities/user.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin'];

@Injectable()
export class TelemetryService {
  constructor(
    @InjectRepository(Telemetry)
    private repo: Repository<Telemetry>,
    private devicesService: DevicesService,
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
    return this.repo.save(record);
  }

  async getLatest(imei: string): Promise<Telemetry | null> {
    return this.repo.findOne({
      where: { imei },
      order: { timestamp: 'DESC' },
    });
  }

  async getHistory(imei: string, limit = 100): Promise<Telemetry[]> {
    return this.repo.find({
      where: { imei },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async getVehicleStats(imei: string): Promise<{
    stopDuration: number | null;
    odometer: number;
    engineHours: number;
  }> {
    const latest = await this.repo.findOne({ where: { imei }, order: { timestamp: 'DESC' } });

    // Stop duration: time since last movement (only meaningful when currently stopped)
    let stopDuration: number | null = null;
    if (latest && latest.speedKmh === 0) {
      const lastMoving = await this.repo.findOne({
        where: { imei, speedKmh: MoreThan(0) },
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
