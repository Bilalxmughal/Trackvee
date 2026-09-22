import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { DriverEvent, DriverEventType } from './entities/driver-event.entity.js';
import { DriverScore } from './entities/driver-score.entity.js';
import { DriverBehaviorSettings } from './entities/driver-behavior-settings.entity.js';
import { Telemetry } from '../telemetry/entities/telemetry.entity.js';
import { Device } from '../devices/entities/device.entity.js';
import { AlertsService } from '../alerts/alerts.service.js';
import { VehicleGroupsService } from '../vehicle-groups/vehicle-groups.service.js';

// Angle diff in [-180, 180]
function angleDiff(a: number, b: number): number {
  let d = ((a - b) % 360 + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}

// Per-vehicle cooldowns to avoid duplicate event detection (vehicleId:type → last ms)
const eventCooldowns = new Map<string, number>();
const EVENT_COOLDOWN_MS = 30_000;

// Per-vehicle+day low_score alert cooldown (vehicleId:YYYY-MM-DD → triggered)
const lowScoreAlertSent = new Map<string, boolean>();

const DEFAULT_SETTINGS: Omit<DriverBehaviorSettings, 'id' | 'organizationId' | 'groupId' | 'vehicleId' | 'createdAt' | 'updatedAt'> = {
  overspeedThreshold: 100,
  harshBrakeDeceleration: 8,
  rapidAccelThreshold: 6,
  sharpTurnAngle: 45,
  sharpTurnMinSpeed: 20,
  deductionHarshBrake: 5,
  deductionRapidAccel: 3,
  deductionSharpTurn: 3,
  deductionOverspeed: 5,
};

@Injectable()
export class DriverBehaviorService {
  constructor(
    @InjectRepository(DriverEvent)
    private eventRepo: Repository<DriverEvent>,
    @InjectRepository(DriverScore)
    private scoreRepo: Repository<DriverScore>,
    @InjectRepository(DriverBehaviorSettings)
    private settingsRepo: Repository<DriverBehaviorSettings>,
    private alertsService: AlertsService,
    private vehicleGroupsService: VehicleGroupsService,
  ) {}

  // Org-level default settings (create on first access)
  async getSettings(organizationId: string): Promise<DriverBehaviorSettings> {
    const existing = await this.settingsRepo.findOne({ where: { organizationId, groupId: IsNull(), vehicleId: IsNull() } });
    if (existing) return existing;
    const created = this.settingsRepo.create({ organizationId, groupId: null, vehicleId: null, ...DEFAULT_SETTINGS });
    return this.settingsRepo.save(created);
  }

  // Hierarchy: vehicle → group → org
  async resolveSettingsForVehicle(vehicleId: string, orgId: string): Promise<DriverBehaviorSettings> {
    const vs = await this.settingsRepo.findOne({ where: { vehicleId } });
    if (vs) return vs;
    const groupId = await this.vehicleGroupsService.getGroupForVehicle(vehicleId);
    if (groupId) {
      const gs = await this.settingsRepo.findOne({ where: { groupId } });
      if (gs) return gs;
    }
    return this.getSettings(orgId);
  }

  // Group settings: get override or null
  async getGroupSettings(groupId: string): Promise<DriverBehaviorSettings | null> {
    return this.settingsRepo.findOne({ where: { groupId } }) ?? null;
  }

  async setGroupSettings(groupId: string, orgId: string, dto: Partial<DriverBehaviorSettings>): Promise<DriverBehaviorSettings> {
    const existing = await this.settingsRepo.findOne({ where: { groupId } });
    if (existing) {
      Object.assign(existing, dto);
      return this.settingsRepo.save(existing);
    }
    const orgDefaults = await this.getSettings(orgId);
    const created = this.settingsRepo.create({ ...orgDefaults, id: undefined as any, organizationId: orgId, groupId, vehicleId: null, ...dto });
    return this.settingsRepo.save(created);
  }

  async clearGroupSettings(groupId: string): Promise<void> {
    await this.settingsRepo.delete({ groupId });
  }

  // Vehicle settings: get override or null
  async getVehicleSettings(vehicleId: string): Promise<DriverBehaviorSettings | null> {
    return this.settingsRepo.findOne({ where: { vehicleId } }) ?? null;
  }

  async setVehicleSettings(vehicleId: string, orgId: string, dto: Partial<DriverBehaviorSettings>): Promise<DriverBehaviorSettings> {
    const existing = await this.settingsRepo.findOne({ where: { vehicleId } });
    if (existing) {
      Object.assign(existing, dto);
      return this.settingsRepo.save(existing);
    }
    const orgDefaults = await this.getSettings(orgId);
    const created = this.settingsRepo.create({ ...orgDefaults, id: undefined as any, organizationId: orgId, groupId: null, vehicleId, ...dto });
    return this.settingsRepo.save(created);
  }

  async clearVehicleSettings(vehicleId: string): Promise<void> {
    await this.settingsRepo.delete({ vehicleId });
  }

  async updateSettings(organizationId: string, dto: Partial<DriverBehaviorSettings>): Promise<DriverBehaviorSettings> {
    const settings = await this.getSettings(organizationId);
    Object.assign(settings, dto);
    return this.settingsRepo.save(settings);
  }

  async getLeaderboard(organizationId: string | null): Promise<{
    scoreId: string; vehicleId: string; organizationId: string | null; orgName: string | null;
    vehicleLicensePlate: string | null; vehicleName: string | null; vehicleMake: string | null; vehicleModel: string | null;
    score: number; date: string; harshBrakeCount: number; rapidAccelCount: number; sharpTurnCount: number; overspeedCount: number;
  }[]> {
    const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    if (organizationId) {
      return this.scoreRepo.query(`
        SELECT DISTINCT ON (ds.vehicle_id)
          ds.id                AS "scoreId",
          ds.vehicle_id        AS "vehicleId",
          ds.organization_id   AS "organizationId",
          o.name               AS "orgName",
          v.license_plate      AS "vehicleLicensePlate",
          v.name               AS "vehicleName",
          v.make               AS "vehicleMake",
          v.model              AS "vehicleModel",
          ds.score,
          ds.date,
          ds.harsh_brake_count AS "harshBrakeCount",
          ds.rapid_accel_count AS "rapidAccelCount",
          ds.sharp_turn_count  AS "sharpTurnCount",
          ds.overspeed_count   AS "overspeedCount"
        FROM driver_scores ds
        LEFT JOIN organizations o ON o.id = ds.organization_id
        LEFT JOIN vehicles v ON v.id = ds.vehicle_id
        WHERE ds.organization_id = $1 AND ds.date >= $2
        ORDER BY ds.vehicle_id, ds.date DESC
      `, [organizationId, cutoff]);
    }
    return this.scoreRepo.query(`
      SELECT DISTINCT ON (ds.vehicle_id)
        ds.id                AS "scoreId",
        ds.vehicle_id        AS "vehicleId",
        ds.organization_id   AS "organizationId",
        o.name               AS "orgName",
        v.license_plate      AS "vehicleLicensePlate",
        v.name               AS "vehicleName",
        v.make               AS "vehicleMake",
        v.model              AS "vehicleModel",
        ds.score,
        ds.date,
        ds.harsh_brake_count AS "harshBrakeCount",
        ds.rapid_accel_count AS "rapidAccelCount",
        ds.sharp_turn_count  AS "sharpTurnCount",
        ds.overspeed_count   AS "overspeedCount"
      FROM driver_scores ds
      LEFT JOIN organizations o ON o.id = ds.organization_id
      LEFT JOIN vehicles v ON v.id = ds.vehicle_id
      WHERE ds.date >= $1
      ORDER BY ds.vehicle_id, ds.date DESC
    `, [cutoff]);
  }

  async deleteScore(id: string): Promise<void> {
    await this.scoreRepo.delete(id);
  }

  async getVehicleScoreHistory(vehicleId: string, days = 30): Promise<DriverScore[]> {
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return this.scoreRepo
      .createQueryBuilder('s')
      .where('s.vehicle_id = :vehicleId', { vehicleId })
      .andWhere('s.date >= :cutoff', { cutoff })
      .orderBy('s.date', 'ASC')
      .getMany();
  }

  async getVehicleEvents(vehicleId: string, from?: string, to?: string): Promise<DriverEvent[]> {
    const qb = this.eventRepo
      .createQueryBuilder('e')
      .where('e.vehicle_id = :vehicleId', { vehicleId })
      .orderBy('e.timestamp', 'DESC')
      .take(200);
    if (from) qb.andWhere('e.timestamp >= :from', { from: new Date(from) });
    if (to) qb.andWhere('e.timestamp <= :to', { to: new Date(to) });
    return qb.getMany();
  }

  async processForDriverBehavior(curr: Telemetry, prev: Telemetry | null, device: Device): Promise<void> {
    if (!device.vehicleId || !curr.gpsValid) return;
    const orgId = device.vehicle?.organizationId ?? null;
    if (!orgId) return;

    const settings = await this.resolveSettingsForVehicle(device.vehicleId, orgId);
    const eventsToRecord: { type: DriverEventType; severity: 'low' | 'medium' | 'high' }[] = [];

    // Overspeed detection
    if (curr.speedKmh > settings.overspeedThreshold) {
      const key = `${device.vehicleId}:overspeed`;
      const last = eventCooldowns.get(key) ?? 0;
      if (Date.now() - last >= EVENT_COOLDOWN_MS) {
        const excess = curr.speedKmh - settings.overspeedThreshold;
        const severity = excess > 30 ? 'high' : excess > 15 ? 'medium' : 'low';
        eventsToRecord.push({ type: 'overspeed', severity });
        eventCooldowns.set(key, Date.now());
      }
    }

    if (prev && curr.gpsValid && prev.gpsValid) {
      const timeDiffSec = (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
      if (timeDiffSec > 0 && timeDiffSec <= 60) {
        // Harsh brake
        if (prev.speedKmh >= 10 && (prev.speedKmh - curr.speedKmh) / timeDiffSec > settings.harshBrakeDeceleration) {
          const key = `${device.vehicleId}:harsh_brake`;
          const last = eventCooldowns.get(key) ?? 0;
          if (Date.now() - last >= EVENT_COOLDOWN_MS) {
            const rate = (prev.speedKmh - curr.speedKmh) / timeDiffSec;
            const severity = rate > settings.harshBrakeDeceleration * 2 ? 'high' : rate > settings.harshBrakeDeceleration * 1.5 ? 'medium' : 'low';
            eventsToRecord.push({ type: 'harsh_brake', severity });
            eventCooldowns.set(key, Date.now());
          }
        }

        // Rapid acceleration
        if ((curr.speedKmh - prev.speedKmh) / timeDiffSec > settings.rapidAccelThreshold) {
          const key = `${device.vehicleId}:rapid_accel`;
          const last = eventCooldowns.get(key) ?? 0;
          if (Date.now() - last >= EVENT_COOLDOWN_MS) {
            const rate = (curr.speedKmh - prev.speedKmh) / timeDiffSec;
            const severity = rate > settings.rapidAccelThreshold * 2 ? 'high' : rate > settings.rapidAccelThreshold * 1.5 ? 'medium' : 'low';
            eventsToRecord.push({ type: 'rapid_accel', severity });
            eventCooldowns.set(key, Date.now());
          }
        }

        // Sharp turn
        if (curr.speedKmh >= settings.sharpTurnMinSpeed) {
          const turn = Math.abs(angleDiff(curr.heading, prev.heading));
          if (turn > settings.sharpTurnAngle) {
            const key = `${device.vehicleId}:sharp_turn`;
            const last = eventCooldowns.get(key) ?? 0;
            if (Date.now() - last >= EVENT_COOLDOWN_MS) {
              const severity = turn > settings.sharpTurnAngle * 1.5 ? 'high' : turn > settings.sharpTurnAngle * 1.2 ? 'medium' : 'low';
              eventsToRecord.push({ type: 'sharp_turn', severity });
              eventCooldowns.set(key, Date.now());
            }
          }
        }
      }
    }

    if (!eventsToRecord.length) return;

    const today = new Date().toISOString().slice(0, 10);

    for (const evt of eventsToRecord) {
      await this.eventRepo.save(this.eventRepo.create({
        vehicleId: device.vehicleId,
        organizationId: orgId,
        imei: curr.imei,
        type: evt.type,
        severity: evt.severity,
        speedKmh: curr.speedKmh,
        latitude: curr.latitude,
        longitude: curr.longitude,
        timestamp: new Date(curr.timestamp),
      }));

      // Deduct from today's score
      const deduction = this.getDeduction(settings, evt.type);
      await this.scoreRepo.query(`
        INSERT INTO driver_scores (id, vehicle_id, organization_id, date, score,
          harsh_brake_count, rapid_accel_count, sharp_turn_count, overspeed_count)
        VALUES (gen_random_uuid(), $1, $2, $3, GREATEST(0, 100 - $4),
          $5, $6, $7, $8)
        ON CONFLICT (vehicle_id, date) DO UPDATE SET
          score = GREATEST(0, driver_scores.score - $4),
          harsh_brake_count  = driver_scores.harsh_brake_count  + $5,
          rapid_accel_count  = driver_scores.rapid_accel_count  + $6,
          sharp_turn_count   = driver_scores.sharp_turn_count   + $7,
          overspeed_count    = driver_scores.overspeed_count    + $8,
          updated_at = NOW()
      `, [
        device.vehicleId, orgId, today, deduction,
        evt.type === 'harsh_brake'  ? 1 : 0,
        evt.type === 'rapid_accel'  ? 1 : 0,
        evt.type === 'sharp_turn'   ? 1 : 0,
        evt.type === 'overspeed'    ? 1 : 0,
      ]);
    }

    // Check low_score alerts once per vehicle per day
    const lowScoreKey = `${device.vehicleId}:${today}`;
    if (!lowScoreAlertSent.get(lowScoreKey)) {
      const scoreRows = await this.scoreRepo.query<{ score: number }[]>(
        `SELECT score FROM driver_scores WHERE vehicle_id = $1 AND date = $2 LIMIT 1`,
        [device.vehicleId, today],
      );
      const currentScore = scoreRows[0]?.score ?? null;
      if (currentScore !== null) {
        const activeAlerts = await this.alertsService.findActiveForImei(curr.imei, orgId);
        for (const alert of activeAlerts) {
          if (alert.type !== 'low_score') continue;
          const threshold = alert.config.scoreThreshold ?? 70;
          if (currentScore <= threshold) {
            lowScoreAlertSent.set(lowScoreKey, true);
            await this.alertsService.logTrigger(alert.id, curr.imei, {
              score: currentScore,
              threshold,
              vehicleId: device.vehicleId,
              date: today,
            });
          }
        }
      }
    }
  }

  private getDeduction(settings: DriverBehaviorSettings, type: DriverEventType): number {
    switch (type) {
      case 'harsh_brake': return settings.deductionHarshBrake;
      case 'rapid_accel': return settings.deductionRapidAccel;
      case 'sharp_turn':  return settings.deductionSharpTurn;
      case 'overspeed':   return settings.deductionOverspeed;
    }
  }
}
