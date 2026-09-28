import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
  ) {}

  async findForUser(user: User, cityId?: string): Promise<Vehicle[]> {
    const cityFilter = cityId ? { cityId } : {};
    if (INTERNAL_ROLES.has(user.role)) {
      return this.repo.find({ where: cityFilter });
    }
    await this.assertCanRead(user);
    if (user.organizationId) {
      const perm = await this.orgPerms.findByUser(user.id);
      if (perm && perm.orgId !== user.organizationId) throw new ForbiddenException();
      if (user.role !== 'client_owner' && perm?.vehicleIds !== null && perm?.vehicleIds !== undefined) {
        if (!perm.vehicleIds.length) return [];
        return this.repo.find({ where: { organizationId: user.organizationId, id: In(perm.vehicleIds), ...cityFilter } });
      }
      return this.repo.find({
        where: [
          { organizationId: user.organizationId, ...cityFilter },
          { ownerId: user.id, ...cityFilter },
        ],
      });
    }
    return this.repo.find({ where: { ownerId: user.id, ...cityFilter } });
  }

  async findOne(id: string, user: User): Promise<Vehicle> {
    await this.assertCanRead(user);
    const vehicle = await this.repo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    await this.assertAccess(vehicle, user);
    return vehicle;
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
    const vehicle = await this.findOne(id, user);
    Object.assign(vehicle, CLIENT_ROLES.has(user.role) ? this.clientEditableFields(data) : data);
    return this.repo.save(vehicle);
  }

  async remove(id: string, user: User): Promise<void> {
    if (CLIENT_ROLES.has(user.role)) await assertClientFeatureAccess(user, 'vehicles', 'delete', this.orgPerms, this.rolePerms);
    const vehicle = await this.findOne(id, user);
    await this.repo.remove(vehicle);
  }

  async sendCommand(vehicleId: string, action: 'immobilize' | 'activate', user: User): Promise<{ sent: boolean; connected: boolean }> {
    const vehicle = await this.findOne(vehicleId, user);
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
    for (const key of ['name', 'licensePlate', 'make', 'model', 'year', 'type', 'isActive'] as const) {
      if (data[key] !== undefined) result[key] = data[key];
    }
    return result as Partial<Vehicle>;
  }
}
