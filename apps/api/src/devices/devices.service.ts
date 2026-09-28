import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Device } from './entities/device.entity.js';
import { User } from '../users/entities/user.entity.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];
const GATEWAY_CMD_URL = process.env['GATEWAY_CMD_URL'] ?? 'http://localhost:5024';
const INTERNAL_KEY = process.env['INTERNAL_API_KEY'] ?? '';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private repo: Repository<Device>,
    private orgPerms: OrgPermissionsService,
    private rolePerms: RolePortalPermissionsService,
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

  async create(data: Partial<Device>): Promise<Device> {
    const device = this.repo.create(data);
    return this.repo.save(device);
  }

  async update(id: string, data: Partial<Device>): Promise<Device> {
    const device = await this.findOne(id);
    Object.assign(device, data);
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
    const command = action === 'immobilize' ? 'DYD#' : 'HFYD#';
    const res = await fetch(`${GATEWAY_CMD_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_KEY },
      body: JSON.stringify({ imei, command }),
    }).catch(() => null);
    if (!res) return { sent: false, connected: false };
    return res.json() as Promise<{ sent: boolean; connected: boolean }>;
  }

  async remove(id: string): Promise<void> {
    const device = await this.findOne(id);
    await this.repo.remove(device);
  }
}
