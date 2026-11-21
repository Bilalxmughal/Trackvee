import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity.js';
import { Device } from '../devices/entities/device.entity.js';
import { User } from '../users/entities/user.entity.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { assertClientFeatureAccess, CLIENT_ROLES, INTERNAL_ROLES, effectiveClientActions } from '../org-permissions/client-feature-access.js';

const GATEWAY_CMD_URL = process.env['GATEWAY_CMD_URL'] ?? 'http://localhost:5024';
const INTERNAL_KEY = process.env['INTERNAL_API_KEY'] ?? '';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private repo: Repository<Vehicle>,
    @InjectRepository(Device)
    private deviceRepo: Repository<Device>,
    private orgPerms: OrgPermissionsService,
    private rolePerms: RolePortalPermissionsService,
    private dataSource: DataSource,
  ) {}

  async findForUser(user: User, cityId?: string): Promise<Vehicle[]> {
    const cityFilter = cityId ? { cityId } : {};
    if (INTERNAL_ROLES.has(user.role)) {
      return (await this.repo.find({ where: cityFilter })).map(vehicle => this.effectiveLifecycle(vehicle));
    }
    await this.assertCanRead(user);
    if (user.organizationId) {
      const perm = await this.orgPerms.findByUser(user.id);
      if (perm && perm.orgId !== user.organizationId) throw new ForbiddenException();
      if (user.role !== 'client_owner' && perm?.vehicleIds !== null && perm?.vehicleIds !== undefined) {
        if (!perm.vehicleIds.length) return [];
        return (await this.repo.find({ where: { organizationId: user.organizationId, id: In(perm.vehicleIds), ...cityFilter } })).map(vehicle => this.effectiveLifecycle(vehicle));
      }
      return (await this.repo.find({
        where: [
          { organizationId: user.organizationId, ...cityFilter },
          { ownerId: user.id, ...cityFilter },
        ],
      })).map(vehicle => this.effectiveLifecycle(vehicle));
    }
    return (await this.repo.find({ where: { ownerId: user.id, ...cityFilter } })).map(vehicle => this.effectiveLifecycle(vehicle));
  }

  async findOne(id: string, user: User): Promise<Vehicle> {
    await this.assertCanRead(user);
    const vehicle = await this.repo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    await this.assertAccess(vehicle, user);
    return this.effectiveLifecycle(vehicle);
  }

  async create(data: Partial<Vehicle>, user: User): Promise<Vehicle> {
    if (CLIENT_ROLES.has(user.role)) await assertClientFeatureAccess(user, 'vehicles', 'add', this.orgPerms, this.rolePerms);
    const autoName = [data.make, data.model, data.licensePlate].filter(Boolean).join(' ') || 'Vehicle';
    const clientFields = CLIENT_ROLES.has(user.role) ? this.clientEditableFields(data) : data;
    const vehicle = this.repo.create({
      ...clientFields,
      name: data.name || autoName,
      ownerId: CLIENT_ROLES.has(user.role) ? user.id : (data.ownerId ?? user.id),
      organizationId: CLIENT_ROLES.has(user.role) ? user.organizationId : (data.organizationId ?? user.organizationId ?? null),
    });
    return this.repo.save(vehicle);
  }

  async update(id: string, data: Partial<Vehicle>, user: User): Promise<Vehicle> {
    if (CLIENT_ROLES.has(user.role)) await assertClientFeatureAccess(user, 'vehicles', 'edit', this.orgPerms, this.rolePerms);
    await this.findOne(id, user); // access check
    const vehicle = await this.repo.findOneOrFail({ where: { id } }); // fresh entity for save
    const updates = CLIENT_ROLES.has(user.role) ? this.clientEditableFields(data) : data;
    const orgChanged = 'organizationId' in updates && updates.organizationId !== vehicle.organizationId;
    Object.assign(vehicle, updates);
    if ('organizationId' in updates && vehicle.organizationId === null) {
      vehicle.organization = null;
    }
    // Cascade org change to maintenance_records to keep data consistent
    if (orgChanged) {
      await this.dataSource.query(
        `UPDATE maintenance_records SET organization_id = $1 WHERE vehicle_id = $2`,
        [updates.organizationId ?? null, id],
      );
    }
    return this.effectiveLifecycle(await this.repo.save(vehicle));
  }

  async remove(id: string, user: User): Promise<{ archived: boolean }> {
    if (CLIENT_ROLES.has(user.role)) await assertClientFeatureAccess(user, 'vehicles', 'delete', this.orgPerms, this.rolePerms);
    const vehicle = await this.findOne(id, user);
    const [history] = await this.dataSource.query(`
      SELECT (
        EXISTS (SELECT 1 FROM device_assignments WHERE vehicle_id = $1)
        OR EXISTS (SELECT 1 FROM devices WHERE vehicle_id = $1)
        OR EXISTS (SELECT 1 FROM driver_events WHERE vehicle_id = $1)
        OR EXISTS (SELECT 1 FROM maintenance_records WHERE vehicle_id = $1)
      ) AS has_history
    `, [id]);
    if (history?.has_history) {
      vehicle.lifecycleStatus = 'archived';
      vehicle.lifecycleReason = 'manual';
      vehicle.isActive = false;
      vehicle.archivedAt = new Date();
      await this.repo.save(vehicle);
      return { archived: true };
    }
    await this.repo.remove(vehicle);
    return { archived: false };
  }

  async updateLifecycle(id: string, lifecycleStatus: 'active' | 'expired' | 'archived', expiresAt: string | null | undefined, user: User): Promise<Vehicle> {
    if (!['super_admin', 'admin', 'ops'].includes(user.role)) throw new ForbiddenException();
    if (!['active', 'expired', 'archived'].includes(lifecycleStatus)) throw new BadRequestException('Invalid vehicle lifecycle status');
    const vehicle = await this.repo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (expiresAt !== undefined && expiresAt !== null && !Number.isFinite(Date.parse(expiresAt))) throw new BadRequestException('Invalid expiry date');
    if (lifecycleStatus === 'active' && expiresAt && Date.parse(expiresAt) <= Date.now()) throw new BadRequestException('An active vehicle must have a future expiry date');
    vehicle.lifecycleStatus = lifecycleStatus;
    vehicle.lifecycleReason = lifecycleStatus === 'active' ? null : 'manual';
    vehicle.isActive = lifecycleStatus === 'active';
    vehicle.expiresAt = expiresAt === undefined ? vehicle.expiresAt : expiresAt ? new Date(expiresAt) : null;
    vehicle.archivedAt = lifecycleStatus === 'archived' ? new Date() : null;
    return this.repo.save(vehicle);
  }

  async sendCommand(vehicleId: string, action: 'immobilize' | 'activate', user: User): Promise<{ sent: boolean; connected: boolean }> {
    const vehicle = await this.findOne(vehicleId, user);
    if (vehicle.lifecycleStatus !== 'active') throw new BadRequestException('Commands are disabled for expired or archived vehicles');
    const device = await this.deviceRepo.findOne({ where: { vehicleId: vehicle.id } });
    if (!device) throw new BadRequestException('No device assigned to this vehicle');

    const command = action === 'immobilize' ? 'DYD#' : 'HFYD#';
    const res = await fetch(`${GATEWAY_CMD_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_KEY },
      body: JSON.stringify({ imei: device.imei, command }),
    }).catch(() => null);

    if (!res) return { sent: false, connected: false };
    const data = await res.json() as { sent: boolean; connected: boolean };
    return data;
  }

  async setOdometer(id: string, odometerKm: number, user: User): Promise<Vehicle> {
    const vehicle = await this.findOne(id, user);
    vehicle.odometerKm = odometerKm;
    // Reset base coords so the next telemetry packet starts fresh from new value
    vehicle.odoBaseLat = null;
    vehicle.odoBaseLng = null;
    return this.repo.save(vehicle);
  }

  async incrementOdometer(vehicleId: string, lat: number, lng: number): Promise<void> {
    const vehicle = await this.repo.findOne({ where: { id: vehicleId } });
    if (!vehicle) return;
    if (vehicle.odoBaseLat !== null && vehicle.odoBaseLng !== null) {
      const R = 6371, r = Math.PI / 180;
      const dLat = (lat - vehicle.odoBaseLat) * r;
      const dLng = (lng - vehicle.odoBaseLng) * r;
      const a = Math.sin(dLat/2)**2 + Math.cos(vehicle.odoBaseLat*r)*Math.cos(lat*r)*Math.sin(dLng/2)**2;
      const distKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      if (distKm > 0.005 && distKm < 5) {
        await this.repo.update(vehicleId, {
          odometerKm: () => `odometer_km + ${distKm.toFixed(4)}`,
          odoBaseLat: lat,
          odoBaseLng: lng,
        } as any);
        return;
      }
    }
    // Just update base coords (no movement or first packet)
    await this.repo.update(vehicleId, { odoBaseLat: lat, odoBaseLng: lng } as any);
  }

  private async assertAccess(vehicle: Vehicle, user: User): Promise<void> {
    if (INTERNAL_ROLES.has(user.role)) return;
    if (user.role !== 'client_owner') {
      const perm = await this.orgPerms.findByUser(user.id);
      if (perm && perm.orgId !== user.organizationId) throw new ForbiddenException();
      if (perm?.vehicleIds !== null && perm?.vehicleIds !== undefined && !perm.vehicleIds.includes(vehicle.id)) throw new ForbiddenException();
    }
    if (user.organizationId && vehicle.organizationId === user.organizationId) return;
    if (vehicle.ownerId === user.id) return;
    throw new ForbiddenException();
  }

  private async assertCanRead(user: User): Promise<void> {
    if (INTERNAL_ROLES.has(user.role)) return;
    if (!CLIENT_ROLES.has(user.role) || !user.organizationId) throw new ForbiddenException('Organization access required');
    const [vehicleActions, mapActions] = await Promise.all([
      effectiveClientActions(user, 'vehicles', this.orgPerms, this.rolePerms),
      effectiveClientActions(user, 'map', this.orgPerms, this.rolePerms),
    ]);
    if (!vehicleActions.includes('view') && !mapActions.includes('view')) throw new ForbiddenException('Vehicle view permission required');
  }

  private clientEditableFields(data: Partial<Vehicle>): Partial<Vehicle> {
    const result: Record<string, unknown> = {};
    for (const key of ['name', 'licensePlate', 'make', 'model', 'year', 'type'] as const) {
      if (data[key] !== undefined) result[key] = data[key];
    }
    return result as Partial<Vehicle>;
  }

  async bulkImport(user: User, items: { licensePlate: string; make?: string; model?: string; year?: string | number }[]): Promise<{ imported: number; skipped: string[] }> {
    const existing = new Set((await this.repo.find({ select: { licensePlate: true } })).map(v => v.licensePlate?.toLowerCase()));
    let imported = 0;
    const skipped: string[] = [];
    for (const item of items) {
      const plate = item.licensePlate?.trim();
      if (!plate) { skipped.push(`Empty license plate`); continue; }
      if (existing.has(plate.toLowerCase())) { skipped.push(`${plate} (duplicate)`); continue; }
      const yr = item.year ? parseInt(String(item.year), 10) : null;
      await this.repo.save(this.repo.create({
        licensePlate: plate,
        make: item.make?.trim() || null,
        model: item.model?.trim() || null,
        year: yr && !isNaN(yr) ? yr : null,
        name: [item.make, item.model, plate].filter(Boolean).join(' '),
        ownerId: user.id,
        organizationId: CLIENT_ROLES.has(user.role) ? user.organizationId : null,
      }));
      existing.add(plate.toLowerCase());
      imported++;
    }
    return { imported, skipped };
  }

  private effectiveLifecycle(vehicle: Vehicle): Vehicle {
    if (vehicle.lifecycleStatus === 'active' && vehicle.expiresAt && vehicle.expiresAt.getTime() <= Date.now()) {
      return { ...vehicle, lifecycleStatus: 'expired', isActive: false };
    }
    return vehicle;
  }
}
