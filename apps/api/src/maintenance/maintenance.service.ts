import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MaintenanceRecord } from './entities/maintenance-record.entity.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { User } from '../users/entities/user.entity.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { assertClientFeatureAccess, CLIENT_ROLES, INTERNAL_ROLES } from '../org-permissions/client-feature-access.js';

export interface MaintenanceInput {
  vehicleId?: string; serviceType?: string; serviceDate?: string; odometerKm?: number | null;
  provider?: string | null; cost?: number | null; notes?: string | null;
  nextDueDate?: string | null; nextDueOdometerKm?: number | null; reminderDaysBefore?: number; reminderKmBefore?: number;
}

export const MAINTENANCE_SERVICE_TYPES = [
  'Engine Oil', 'Tuning', 'Oil Filter', 'Air Filter', 'AC Filter', 'Fuel Filter',
  'Brake Pads', 'Brake Fluid', 'Coolant', 'Transmission Oil', 'Battery', 'Tyre Rotation',
  'General Inspection', 'Other',
] as const;

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenanceRecord) private readonly records: Repository<MaintenanceRecord>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly orgPermissions: OrgPermissionsService,
    private readonly rolePermissions: RolePortalPermissionsService,
  ) {}

  async list(user: User, query: { organizationId?: string; vehicleId?: string; status?: string }) {
    await this.assertFeature(user, 'view');
    const orgId = this.resolveOrgId(user, query.organizationId);
    if (query.vehicleId) await this.assertVehicle(user, query.vehicleId, orgId);
    let qb = this.records.createQueryBuilder('record').where('record.organization_id = :orgId', { orgId });
    if (query.vehicleId) qb = qb.andWhere('record.vehicle_id = :vehicleId', { vehicleId: query.vehicleId });
    if (CLIENT_ROLES.has(user.role) && user.role !== 'client_owner') {
      const perm = await this.orgPermissions.findByUser(user.id);
      if (perm && perm.orgId !== user.organizationId) throw new ForbiddenException();
      if (perm?.vehicleIds != null) {
        if (!perm.vehicleIds.length) return [];
        qb = qb.andWhere('record.vehicle_id IN (:...vehicleIds)', { vehicleIds: perm.vehicleIds });
      }
    }
    const rows = await qb.orderBy('record.service_date', 'DESC').addOrderBy('record.created_at', 'DESC').take(500).getMany();
    const vehicleIds = [...new Set(rows.map(row => row.vehicleId))];
    const vehicles = vehicleIds.length ? await this.vehicles.find({ where: { id: In(vehicleIds), organizationId: orgId } }) : [];
    const vehicleMap = new Map(vehicles.map(vehicle => [vehicle.id, vehicle]));
    const latestByType = new Set<string>();
    const odometerRows = await this.estimatedOdometers(orgId);
    const odometerByRecord = new Map(odometerRows.map(row => [row.record_id, row.current_odometer_km == null ? null : Number(row.current_odometer_km)]));
    const now = new Date();
    const result = rows.map(record => {
      const key = `${record.vehicleId}:${record.serviceType.toLowerCase()}`;
      const latest = !latestByType.has(key);
      latestByType.add(key);
      const rowVehicle = vehicleMap.get(record.vehicleId);
      if (!rowVehicle) return null;
      const vehicle = { id: rowVehicle.id, name: rowVehicle.name, licensePlate: rowVehicle.licensePlate, make: rowVehicle.make, model: rowVehicle.model };
      const dueDate = record.nextDueDate ? new Date(`${record.nextDueDate}T23:59:59+05:00`) : null;
      const dueSoonAt = dueDate ? new Date(now.getTime() + record.reminderDaysBefore * 86_400_000) : null;
      const currentOdometerKm = latest ? odometerByRecord.get(record.id) ?? (record.odometerKm == null ? null : Number(record.odometerKm)) : null;
      const dueByDate = !!dueDate && dueDate < now;
      const dueByOdometer = record.nextDueOdometerKm != null && currentOdometerKm != null && currentOdometerKm >= Number(record.nextDueOdometerKm);
      const upcomingByDate = !!dueDate && !!dueSoonAt && dueDate <= dueSoonAt;
      const upcomingByOdometer = record.nextDueOdometerKm != null && currentOdometerKm != null && currentOdometerKm >= Number(record.nextDueOdometerKm) - record.reminderKmBefore;
      const status = !latest || (!dueDate && record.nextDueOdometerKm == null) ? 'completed'
        : dueByDate || dueByOdometer ? 'overdue'
        : upcomingByDate || upcomingByOdometer ? 'upcoming' : 'scheduled';
      return { ...record, vehicle, currentOdometerKm, status };
    }).filter((item): item is NonNullable<typeof item> => item !== null);
    if (!query.status || query.status === 'all') return result;
    return result.filter(item => item.status === query.status);
  }

  async listVehicles(user: User, requestedOrgId?: string) {
    await this.assertFeature(user, 'view');
    const orgId = this.resolveOrgId(user, requestedOrgId);
    let ids: string[] | null = null;
    if (CLIENT_ROLES.has(user.role) && user.role !== 'client_owner') {
      const perm = await this.orgPermissions.findByUser(user.id);
      if (perm && perm.orgId !== user.organizationId) throw new ForbiddenException();
      ids = perm?.vehicleIds ?? null;
      if (ids && ids.length === 0) return [];
    }
    return this.vehicles.find({
      where: { organizationId: orgId, ...(ids ? { id: In(ids) } : {}) },
      select: { id: true, displayId: true, name: true, licensePlate: true, make: true, model: true },
      order: { licensePlate: 'ASC', displayId: 'ASC' },
    });
  }

  async getAlertState(vehicleId: string, orgId: string, serviceType: string): Promise<{ recordId: string; status: 'upcoming' | 'overdue'; dueDate: string | null; dueOdometerKm: string | null } | null> {
    const record = await this.records.createQueryBuilder('record')
      .where('record.organization_id = :orgId AND record.vehicle_id = :vehicleId', { orgId, vehicleId })
      .andWhere('lower(record.service_type) = lower(:serviceType)', { serviceType })
      .orderBy('record.service_date', 'DESC').addOrderBy('record.created_at', 'DESC').getOne();
    if (!record || (!record.nextDueDate && record.nextDueOdometerKm == null)) return null;
    const now = new Date();
    const dueDate = record.nextDueDate ? new Date(`${record.nextDueDate}T23:59:59+05:00`) : null;
    const dueByDate = !!dueDate && dueDate < now;
    const upcomingByDate = !!dueDate && dueDate.getTime() <= now.getTime() + record.reminderDaysBefore * 86_400_000;
    let currentOdometerKm: number | null = null;
    if (record.nextDueOdometerKm != null) {
      const estimates = await this.estimatedOdometers(orgId);
      const estimate = estimates.find(row => row.record_id === record.id)?.current_odometer_km;
      currentOdometerKm = estimate == null ? null : Number(estimate);
    }
    const dueByOdometer = record.nextDueOdometerKm != null && currentOdometerKm != null && currentOdometerKm >= Number(record.nextDueOdometerKm);
    const upcomingByOdometer = record.nextDueOdometerKm != null && currentOdometerKm != null && currentOdometerKm >= Number(record.nextDueOdometerKm) - record.reminderKmBefore;
    if (dueByDate || dueByOdometer) return { recordId: record.id, status: 'overdue', dueDate: record.nextDueDate, dueOdometerKm: record.nextDueOdometerKm };
    if (upcomingByDate || upcomingByOdometer) return { recordId: record.id, status: 'upcoming', dueDate: record.nextDueDate, dueOdometerKm: record.nextDueOdometerKm };
    return null;
  }

  async create(user: User, body: MaintenanceInput, organizationId?: string) {
    await this.assertFeature(user, 'add');
    const orgId = this.resolveOrgId(user, organizationId);
    const data = this.validate(body, true);
    this.assertOdometerReminderBaseline(data.odometerKm, data.nextDueOdometerKm);
    const vehicle = await this.assertVehicle(user, data.vehicleId!, orgId);
    const record = this.records.create({ ...data, vehicleId: vehicle.id, organizationId: orgId, createdBy: user.id });
    return this.records.save(record);
  }

  async update(user: User, id: string, body: MaintenanceInput) {
    await this.assertFeature(user, 'edit');
    const existing = await this.records.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Maintenance record not found');
    await this.assertVehicle(user, existing.vehicleId, existing.organizationId);
    const changes = this.validate({ ...body, vehicleId: undefined }, false);
    this.assertOdometerReminderBaseline(
      changes.odometerKm !== undefined ? changes.odometerKm : existing.odometerKm,
      changes.nextDueOdometerKm !== undefined ? changes.nextDueOdometerKm : existing.nextDueOdometerKm,
    );
    Object.assign(existing, changes);
    return this.records.save(existing);
  }

  async remove(user: User, id: string) {
    await this.assertFeature(user, 'delete');
    const existing = await this.records.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Maintenance record not found');
    await this.assertVehicle(user, existing.vehicleId, existing.organizationId);
    await this.records.remove(existing);
  }

  private validate(input: MaintenanceInput, creating: boolean): Partial<MaintenanceRecord> {
    const value: Record<string, unknown> = {};
    if (creating || input.vehicleId !== undefined) {
      if (typeof input.vehicleId !== 'string' || !input.vehicleId) throw new BadRequestException('Select a vehicle');
      value['vehicleId'] = input.vehicleId;
    }
    if (creating || input.serviceType !== undefined) {
      if (typeof input.serviceType !== 'string' || !input.serviceType.trim() || input.serviceType.length > 80) throw new BadRequestException('Enter a service type');
      value['serviceType'] = input.serviceType.trim();
    }
    if (creating || input.serviceDate !== undefined) {
      if (!this.isValidDate(input.serviceDate)) throw new BadRequestException('Enter a valid service date');
      value['serviceDate'] = input.serviceDate;
    }
    for (const [field, max] of [['odometerKm', 1_000_000_000], ['cost', 1_000_000_000], ['nextDueOdometerKm', 1_000_000_000]] as const) {
      const n = input[field];
      if (n !== undefined) {
        if (n !== null && (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > max)) throw new BadRequestException(`Invalid ${field}`);
        value[field] = n;
      }
    }
    for (const field of ['provider', 'notes'] as const) {
      const text = input[field];
      if (text !== undefined) {
        const max = field === 'provider' ? 120 : 4000;
        if (text !== null && (typeof text !== 'string' || text.length > max)) throw new BadRequestException(`Invalid ${field}`);
        value[field] = text?.trim() || null;
      }
    }
    if (input.nextDueDate !== undefined) {
      if (input.nextDueDate !== null && !this.isValidDate(input.nextDueDate)) throw new BadRequestException('Enter a valid next service date');
      value['nextDueDate'] = input.nextDueDate;
    }
    if (input.reminderDaysBefore !== undefined) {
      if (!Number.isInteger(input.reminderDaysBefore) || input.reminderDaysBefore < 0 || input.reminderDaysBefore > 365) throw new BadRequestException('Reminder lead time must be between 0 and 365 days');
      value['reminderDaysBefore'] = input.reminderDaysBefore;
    }
    if (input.reminderKmBefore !== undefined) {
      if (!Number.isInteger(input.reminderKmBefore) || input.reminderKmBefore < 0 || input.reminderKmBefore > 100_000) throw new BadRequestException('Reminder lead distance must be between 0 and 100,000 km');
      value['reminderKmBefore'] = input.reminderKmBefore;
    }
    return value as Partial<MaintenanceRecord>;
  }

  private isValidDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  private assertOdometerReminderBaseline(odometerKm?: number | string | null, nextDueOdometerKm?: number | string | null) {
    if (nextDueOdometerKm != null && odometerKm == null) {
      throw new BadRequestException('Enter the service odometer to use an odometer reminder');
    }
  }

  private async estimatedOdometers(orgId: string): Promise<{ record_id: string; current_odometer_km: string | null }[]> {
    // Estimate distance after each latest service from valid GPS samples; use the entered service odometer as its baseline.
    return this.records.query(`
      WITH latest AS (
        SELECT DISTINCT ON (vehicle_id, lower(service_type)) id, vehicle_id, service_date, odometer_km
        FROM maintenance_records
        WHERE organization_id = $1 AND next_due_odometer_km IS NOT NULL
        ORDER BY vehicle_id, lower(service_type), service_date DESC, created_at DESC
      ), assigned_device AS (
        SELECT DISTINCT ON (vehicle_id) vehicle_id, imei
        FROM devices WHERE vehicle_id IN (SELECT vehicle_id FROM latest)
        ORDER BY vehicle_id, updated_at DESC
      ), samples AS (
        SELECT l.id AS record_id, l.odometer_km, t.latitude, t.longitude,
          LAG(t.latitude) OVER (PARTITION BY l.id ORDER BY t.timestamp) AS prev_lat,
          LAG(t.longitude) OVER (PARTITION BY l.id ORDER BY t.timestamp) AS prev_lng
        FROM latest l
        JOIN assigned_device d ON d.vehicle_id = l.vehicle_id
        JOIN telemetry t ON t.imei = d.imei AND t.gps_valid = true
          AND t.timestamp >= (l.service_date::timestamptz)
      ), totals AS (
        SELECT record_id, MAX(odometer_km) AS baseline_km,
          COALESCE(SUM(6371 * 2 * ASIN(LEAST(1.0, SQRT(
            POWER(SIN((RADIANS(latitude) - RADIANS(prev_lat)) / 2), 2) +
            COS(RADIANS(prev_lat)) * COS(RADIANS(latitude)) *
            POWER(SIN((RADIANS(longitude) - RADIANS(prev_lng)) / 2), 2)
          )))), 0) AS distance_km
        FROM samples WHERE prev_lat IS NOT NULL GROUP BY record_id
      )
      SELECT l.id AS record_id,
        CASE WHEN COALESCE(t.baseline_km, l.odometer_km) IS NULL THEN NULL
          ELSE (COALESCE(t.baseline_km, l.odometer_km) + COALESCE(t.distance_km, 0))::text
        END AS current_odometer_km
      FROM latest l LEFT JOIN totals t ON t.record_id = l.id
    `, [orgId]);
  }

  private async assertFeature(user: User, action: 'view' | 'add' | 'edit' | 'delete') {
    if (CLIENT_ROLES.has(user.role)) await assertClientFeatureAccess(user, 'maintenance', action, this.orgPermissions, this.rolePermissions);
    else if (!INTERNAL_ROLES.has(user.role)) throw new ForbiddenException();
  }

  private resolveOrgId(user: User, requested?: string): string {
    if (CLIENT_ROLES.has(user.role)) {
      if (!user.organizationId || (requested && requested !== user.organizationId)) throw new ForbiddenException();
      return user.organizationId;
    }
    if (!requested) throw new BadRequestException('Organization is required');
    return requested;
  }

  private async assertVehicle(user: User, vehicleId: string, orgId?: string): Promise<Vehicle> {
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId } });
    if (!vehicle || !vehicle.organizationId || (orgId && vehicle.organizationId !== orgId)) throw new NotFoundException('Vehicle not found');
    if (CLIENT_ROLES.has(user.role)) {
      if (vehicle.organizationId !== user.organizationId) throw new NotFoundException('Vehicle not found');
      if (user.role !== 'client_owner') {
        const perm = await this.orgPermissions.findByUser(user.id);
        if (perm && perm.orgId !== user.organizationId) throw new ForbiddenException();
        if (perm?.vehicleIds != null && !perm.vehicleIds.includes(vehicle.id)) throw new ForbiddenException('Vehicle access denied');
      }
    }
    return vehicle;
  }
}
