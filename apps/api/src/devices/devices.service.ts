import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Device } from './entities/device.entity.js';
import { User } from '../users/entities/user.entity.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { assertClientFeatureAccess } from '../org-permissions/client-feature-access.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];
const DEVICE_MANAGER_ROLES = new Set(['super_admin', 'admin', 'ops']);
const GATEWAY_CMD_URL = process.env['GATEWAY_CMD_URL'] ?? 'http://localhost:5024';
const INTERNAL_KEY = process.env['INTERNAL_API_KEY'] ?? '';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private repo: Repository<Device>,
    private orgPerms: OrgPermissionsService,
    private rolePerms: RolePortalPermissionsService,
    private dataSource: DataSource,
  ) {}

  async findAll(user?: User, cityId?: string): Promise<Device[]> {
    const cityFilter = cityId ? { cityId } : {};
    if (!user || ADMIN_ROLES.includes(user.role)) {
      return this.repo.find({ relations: { vehicle: true }, where: cityFilter });
    }
    if (user.organizationId) {
      if (user.role !== 'client_owner') {
        const perm = await this.orgPerms.findByUser(user.id);
        if (perm && perm.orgId !== user.organizationId) throw new ForbiddenException();
        if (perm?.vehicleIds !== null && perm?.vehicleIds !== undefined) {
          if (!perm.vehicleIds.length) return [];
          return this.repo.find({ relations: { vehicle: true }, where: { vehicle: { organizationId: user.organizationId, id: In(perm.vehicleIds) }, ...cityFilter } });
        }
      }
      return this.repo.find({
        relations: { vehicle: true },
        where: { vehicle: { organizationId: user.organizationId }, ...cityFilter },
      });
    }
    return Promise.resolve([]);
  }

  async findByImei(imei: string): Promise<Device | null> {
    return this.repo.findOne({ where: { imei }, relations: { vehicle: true } });
  }

  async findOne(id: string): Promise<Device> {
    const device = await this.repo.findOne({ where: { id }, relations: { vehicle: true } });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async findOneForUser(id: string, user: User): Promise<Device> {
    this.assertInternal(user);
    return this.findOne(id);
  }

  async inventory(user: User, filters: { cityId?: string; organizationId?: string; ownerId?: string; status?: string; from?: string; to?: string; search?: string }) {
    this.assertInternal(user);
    const params: unknown[] = [];
    const where: string[] = [];
    const add = (sql: string, value: unknown) => { params.push(value); where.push(sql.replace('?', `$${params.length}`)); };
    if (filters.cityId) add('d.city_id = ?::uuid', filters.cityId);
    if (filters.organizationId) add('v.organization_id = ?::uuid', filters.organizationId);
    if (filters.ownerId) add(`EXISTS (
      SELECT 1 FROM users selected_user
      LEFT JOIN org_user_permissions selected_perm ON selected_perm.user_id = selected_user.id AND selected_perm.org_id = v.organization_id
      WHERE selected_user.id = ?::uuid AND selected_user.organization_id = v.organization_id
        AND COALESCE(selected_perm.vehicles_view, TRUE) = TRUE
        AND (selected_perm.vehicle_ids IS NULL OR v.id::text = ANY(selected_perm.vehicle_ids))
    )`, filters.ownerId);
    if (filters.from) add('d.created_at >= ?::timestamptz', filters.from);
    if (filters.to) add('d.created_at < (?::date + INTERVAL \'1 day\')', filters.to);
    if (filters.search?.trim()) {
      params.push(`%${filters.search.trim()}%`);
      where.push(`(d.imei ILIKE $${params.length} OR COALESCE(d.name, '') ILIKE $${params.length} OR COALESCE(v.license_plate, '') ILIKE $${params.length})`);
    }
    if (filters.status === 'assigned') where.push("d.inventory_status = 'assigned'");
    if (filters.status === 'in_stock') where.push("d.inventory_status = 'in_stock'");
    if (filters.status === 'maintenance') where.push("d.inventory_status = 'maintenance'");
    if (filters.status === 'retired') where.push("d.inventory_status = 'retired'");
    if (filters.status === 'online') where.push("d.last_seen_at >= NOW() - INTERVAL '5 minutes'");
    if (filters.status === 'offline') where.push("(d.last_seen_at IS NULL OR d.last_seen_at < NOW() - INTERVAL '5 minutes')");
    const rows = await this.dataSource.query(`
      SELECT d.id, d.display_id AS "displayId", d.imei, d.name, d.sim_number AS "simNumber",
             d.status, d.inventory_status AS "inventoryStatus", d.city_id AS "cityId", d.last_seen_at AS "lastSeenAt", d.created_at AS "createdAt",
             v.id AS "vehicleId", v.display_id AS "vehicleDisplayId", v.license_plate AS "licensePlate",
             v.make, v.model, v.organization_id AS "organizationId",
             o.name AS "clientName"
      FROM devices d
      LEFT JOIN vehicles v ON v.id = d.vehicle_id
      LEFT JOIN organizations o ON o.id = v.organization_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY d.created_at DESC
    `, params);
    return rows;
  }

  async assignmentHistory(vehicleId: string, user: User) {
    if (!ADMIN_ROLES.includes(user.role)) {
      if (!user.organizationId) throw new ForbiddenException();
      await assertClientFeatureAccess(user, 'vehicles', 'view', this.orgPerms, this.rolePerms);
      const permission = user.role === 'client_owner' ? null : await this.orgPerms.findByUser(user.id);
      if (permission && permission.orgId !== user.organizationId) throw new ForbiddenException();
      if (permission?.vehicleIds != null && !permission.vehicleIds.includes(vehicleId)) throw new ForbiddenException();
      const allowed = await this.dataSource.query('SELECT id FROM vehicles WHERE id = $1 AND organization_id = $2', [vehicleId, user.organizationId]);
      if (!allowed.length) throw new NotFoundException('Vehicle not found');
    }
    const historyOrg = ADMIN_ROLES.includes(user.role) ? null : user.organizationId;
    const rows = await this.dataSource.query(`
      SELECT a.id, a.vehicle_id AS "vehicleId", a.assigned_at AS "assignedAt", a.unassigned_at AS "unassignedAt",
             a.action, a.reason, a.odometer_km AS "odometerKm", a.notes,
             d.display_id AS "deviceDisplayId", d.imei, d.sim_number AS "simNumber",
             u.first_name AS "assignedByFirstName", u.last_name AS "assignedByLastName"
      FROM device_assignments a
      JOIN devices d ON d.id = a.device_id
      LEFT JOIN users u ON u.id = a.assigned_by
      WHERE a.vehicle_id = $1 AND ($2::uuid IS NULL OR a.organization_id = $2)
      ORDER BY a.assigned_at DESC
    `, [vehicleId, historyOrg]);
    if (ADMIN_ROLES.includes(user.role)) return rows;
    return rows.map(({ imei: _imei, simNumber, ...row }: Record<string, unknown>) => ({ ...row, simNumber: typeof simNumber === 'string' ? `••••${simNumber.slice(-4)}` : null }));
  }

  async deviceAssignmentHistory(deviceId: string, user: User) {
    this.assertInternal(user);
    const device = await this.findOne(deviceId);
    const rows = await this.dataSource.query(`
      SELECT a.id, a.vehicle_id AS "vehicleId", v.license_plate AS "licensePlate",
             v.display_id AS "vehicleDisplayId", a.assigned_at AS "assignedAt", a.unassigned_at AS "unassignedAt",
             a.action, a.reason, a.odometer_km AS "odometerKm", a.notes,
             u.first_name AS "assignedByFirstName", u.last_name AS "assignedByLastName"
      FROM device_assignments a
      JOIN vehicles v ON v.id = a.vehicle_id
      LEFT JOIN users u ON u.id = a.assigned_by
      WHERE a.device_id = $1 ORDER BY a.assigned_at DESC
    `, [deviceId]);
    return { device: { id: device.id, displayId: device.displayId, imei: device.imei }, assignments: rows };
  }

  async assign(user: User, deviceId: string, input: { vehicleId: string | null; replaceCurrent?: boolean; reason?: string; odometerKm?: number | null; notes?: string }) {
    this.assertDeviceManager(user);
    if (input.vehicleId === undefined) throw new BadRequestException('Select a vehicle or choose Unassigned');
    if (input.odometerKm != null && (!Number.isFinite(input.odometerKm) || input.odometerKm < 0)) throw new BadRequestException('Odometer must be zero or greater');
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const [device] = await runner.query('SELECT id, imei, vehicle_id FROM devices WHERE id = $1 FOR UPDATE', [deviceId]);
      if (!device) throw new NotFoundException('Device not found');
      if (device.inventory_status === 'retired' || device.inventory_status === 'maintenance') throw new BadRequestException(`A ${device.inventory_status} device cannot be assigned`);
      if (input.vehicleId) {
        const [target] = await runner.query('SELECT id, license_plate, lifecycle_status, expires_at FROM vehicles WHERE id = $1 FOR UPDATE', [input.vehicleId]);
        if (!target) throw new NotFoundException('Vehicle not found');
        if (target.lifecycle_status !== 'active' || (target.expires_at && new Date(target.expires_at).getTime() <= Date.now())) throw new BadRequestException('A device can only be assigned to an active vehicle');
        const [occupied] = await runner.query(`SELECT d.id, v.license_plate FROM devices d JOIN vehicles v ON v.id = d.vehicle_id WHERE d.vehicle_id = $1 AND d.id <> $2 LIMIT 1 FOR UPDATE OF d`, [input.vehicleId, deviceId]);
        if (input.replaceCurrent && !occupied) throw new BadRequestException('The selected vehicle has no device to replace');
        if (occupied && !input.replaceCurrent) throw new ConflictException(`Vehicle ${occupied.license_plate || 'selected vehicle'} already has an active device. Choose Replace current device to continue.`);
        if (occupied) {
        await runner.query(`UPDATE device_assignments SET unassigned_at = GREATEST(clock_timestamp(), assigned_at + INTERVAL '1 millisecond'), unassigned_by = $2, action = 'replacement', reason = COALESCE($3, reason), notes = COALESCE($4, notes) WHERE device_id = $1 AND unassigned_at IS NULL`, [occupied.id, user.id, input.reason ?? null, input.notes ?? null]);
          await runner.query(`UPDATE devices SET vehicle_id = NULL, inventory_status = 'in_stock', updated_at = NOW() WHERE id = $1`, [occupied.id]);
        }
      }
      const oldVehicleId = device.vehicle_id as string | null;
      if (oldVehicleId === input.vehicleId) {
        await runner.commitTransaction();
        return this.findOne(deviceId);
      }
      const now = new Date();
      if (oldVehicleId) {
        await runner.query(`UPDATE device_assignments SET unassigned_at = GREATEST($2::timestamptz, assigned_at + INTERVAL '1 millisecond'), unassigned_by = $3, action = CASE WHEN $4::boolean THEN 'replacement' ELSE 'transfer' END, reason = COALESCE($5, reason), odometer_km = COALESCE($6, odometer_km), notes = COALESCE($7, notes) WHERE device_id = $1 AND unassigned_at IS NULL`, [deviceId, now, user.id, !!input.vehicleId, input.reason ?? null, input.odometerKm ?? null, input.notes ?? null]);
      }
      await runner.query('UPDATE devices SET vehicle_id = $2, inventory_status = $3, updated_at = NOW() WHERE id = $1', [deviceId, input.vehicleId, input.vehicleId ? 'assigned' : 'in_stock']);
      if (input.vehicleId) {
        await runner.query(`INSERT INTO device_assignments (device_id, vehicle_id, organization_id, assigned_at, assigned_by, action, reason, odometer_km, notes) SELECT $1, v.id, v.organization_id, GREATEST($3::timestamptz, COALESCE((SELECT MAX(unassigned_at) FROM device_assignments WHERE device_id = $1), $3::timestamptz), COALESCE((SELECT MAX(unassigned_at) FROM device_assignments WHERE vehicle_id = $2), $3::timestamptz)), $4, $5, $6, $7, $8 FROM vehicles v WHERE v.id = $2`, [deviceId, input.vehicleId, now, user.id, input.replaceCurrent ? 'replacement' : oldVehicleId ? 'transfer' : 'assignment', input.reason ?? null, input.odometerKm ?? null, input.notes ?? null]);
      }
      await runner.commitTransaction();
      return this.findOne(deviceId);
    } catch (error) {
      await runner.rollbackTransaction();
      const err = error as { code?: string };
      if (err.code === '23505') throw new ConflictException('This device or vehicle already has an active assignment');
      throw error;
    } finally {
      await runner.release();
    }
  }

  async create(user: User, data: Partial<Device>): Promise<Device> {
    this.assertDeviceManager(user);
    if (!data.imei?.trim()) throw new BadRequestException('IMEI is required');
    if (data.vehicleId) throw new BadRequestException('Create the device first, then use the assignment action');
    if (data.inventoryStatus && data.inventoryStatus !== 'in_stock') throw new BadRequestException('New devices must start in stock');
    const device = this.repo.create(data);
    return this.repo.save(device);
  }

  async update(user: User, id: string, data: Partial<Device>): Promise<Device> {
    this.assertDeviceManager(user);
    if (data.vehicleId !== undefined) throw new BadRequestException('Use the device assignment action to change vehicle assignment');
    const device = await this.findOne(id);
    if (data.inventoryStatus !== undefined) {
      if (data.inventoryStatus === 'assigned') throw new BadRequestException('Use the assignment action to mark a device assigned');
      if (device.vehicleId) throw new BadRequestException('Unassign the device before changing its inventory status');
      if (!['in_stock', 'maintenance', 'retired'].includes(data.inventoryStatus)) throw new BadRequestException('Invalid inventory status');
    }
    for (const key of ['name', 'simNumber', 'cityId', 'status', 'inventoryStatus'] as const) if (data[key] !== undefined) Object.assign(device, { [key]: data[key] });
    return this.repo.save(device);
  }

  async updateLastSeen(imei: string): Promise<void> {
    await this.repo.update({ imei }, { lastSeenAt: new Date(), status: 'active' });
  }

  async saveHeartbeat(imei: string, data: {
    ignition: boolean; externalPower: boolean; immobilizer: boolean;
    voltageLevel: number; gsmSignal: number;
  }): Promise<void> {
    await this.repo.update({ imei }, {
      lastIgnition: data.ignition,
      lastExternalPower: data.externalPower,
      lastImmobilizer: data.immobilizer,
      lastVoltageLevel: data.voltageLevel,
      lastGsmSignal: data.gsmSignal,
      lastSeenAt: new Date(),
      status: 'active',
    });
  }

  async getLastHeartbeat(imei: string): Promise<{
    ignition: boolean | null; externalPower: boolean | null;
    immobilizer: boolean | null; voltageLevel: number | null; gsmSignal: number | null;
  } | null> {
    const d = await this.repo.findOne({ where: { imei }, select: { lastIgnition: true, lastExternalPower: true, lastImmobilizer: true, lastVoltageLevel: true, lastGsmSignal: true } });
    if (!d || d.lastIgnition == null) return null;
    return {
      ignition: d.lastIgnition,
      externalPower: d.lastExternalPower,
      immobilizer: d.lastImmobilizer,
      voltageLevel: d.lastVoltageLevel,
      gsmSignal: d.lastGsmSignal,
    };
  }

  async sendCommandByImei(user: User, imei: string, action: 'immobilize' | 'activate'): Promise<{ sent: boolean; connected: boolean }> {
    if (action !== 'immobilize' && action !== 'activate') throw new BadRequestException('Invalid device command');
    if (ADMIN_ROLES.includes(user.role)) {
      if (!['super_admin', 'admin', 'ops'].includes(user.role)) throw new ForbiddenException('Engine command not permitted');
    } else {
      const rolePermissions = (await this.rolePerms.findAll())[user.role];
      const permitted = rolePermissions && Object.prototype.hasOwnProperty.call(rolePermissions, 'engine_cut')
        ? rolePermissions['engine_cut']?.includes('view')
        : ['client_owner', 'client_super_admin'].includes(user.role);
      if (!permitted) throw new ForbiddenException('Engine command not permitted');
    }
    const device = (await this.findAll(user)).find(item => item.imei === imei);
    if (!device) throw new BadRequestException('Device not found');
    if (!device.vehicleId || device.vehicle?.lifecycleStatus !== 'active') throw new BadRequestException('Commands are disabled for unassigned, expired, or archived vehicles');
    const command = action === 'immobilize' ? 'DYD#' : 'HFYD#';
    const res = await fetch(`${GATEWAY_CMD_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_KEY },
      body: JSON.stringify({ imei, command }),
    }).catch(() => null);
    if (!res) return { sent: false, connected: false };
    return res.json() as Promise<{ sent: boolean; connected: boolean }>;
  }

  async remove(id: string, user: User): Promise<void> {
    this.assertDeviceManager(user);
    const device = await this.findOne(id);
    const [{ count }] = await this.dataSource.query('SELECT (SELECT COUNT(*) FROM telemetry WHERE device_id = $1 OR imei = $2) + (SELECT COUNT(*) FROM device_assignments WHERE device_id = $1) AS count', [id, device.imei]);
    if (Number(count) > 0) throw new BadRequestException('Devices with telemetry history cannot be deleted; unassign and mark them inactive instead');
    await this.repo.remove(device);
  }

  private assertInternal(user: User): void {
    if (!user || !ADMIN_ROLES.includes(user.role)) throw new ForbiddenException();
  }

  private assertDeviceManager(user: User): void {
    if (!user || !DEVICE_MANAGER_ROLES.has(user.role)) throw new ForbiddenException();
  }
}
