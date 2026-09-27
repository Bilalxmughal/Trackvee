import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Alert } from './entities/alert.entity.js';
import { AlertLog } from './entities/alert-log.entity.js';
import { User } from '../users/entities/user.entity.js';
import { DevicesService } from '../devices/devices.service.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert) private repo: Repository<Alert>,
    @InjectRepository(AlertLog) private logRepo: Repository<AlertLog>,
    private dataSource: DataSource,
    private devices: DevicesService,
    private orgPerms: OrgPermissionsService,
    private rolePerms: RolePortalPermissionsService,
  ) {}

  findAll(user: User, orgId?: string): Promise<Alert[]> {
    if (ADMIN_ROLES.includes(user.role)) {
      if (orgId) return this.repo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    const resolvedOrgId = user.organizationId;
    if (!resolvedOrgId) return Promise.resolve([]);
    return this.repo.find({ where: { orgId: resolvedOrgId }, order: { createdAt: 'DESC' } });
  }

  // Returns active alerts for a given IMEI (used during telemetry evaluation)
  async findActiveForImei(imei: string, orgId: string | null): Promise<Alert[]> {
    const all = await this.repo.find({ where: { active: true } });
    return all.filter(a => {
      if (orgId && a.orgId && a.orgId !== orgId) return false;
      return !(a.excludedVehicleImeis ?? []).includes(imei) && (a.vehicleImeis.length === 0 || a.vehicleImeis.includes(imei));
    });
  }

  async create(user: User, dto: Partial<Alert>, orgId?: string): Promise<Alert> {
    if (ADMIN_ROLES.includes(user.role) && !['super_admin', 'admin', 'ops'].includes(user.role)) throw new ForbiddenException('Alert action not permitted');
    if (!ADMIN_ROLES.includes(user.role)) await this.assertRuleWrite(user, dto.vehicleImeis ?? [], 'add');
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : (user.organizationId ?? null);
    const a = this.repo.create({ ...dto, orgId: resolvedOrgId, excludedVehicleImeis: [] });
    return this.repo.save(a);
  }

  async update(id: string, dto: Partial<Alert>, user: User): Promise<Alert> {
    if (ADMIN_ROLES.includes(user.role) && !['super_admin', 'admin', 'ops'].includes(user.role)) throw new ForbiddenException('Alert action not permitted');
    const rule = await this.getAccessibleRule(id, user);
    if (!ADMIN_ROLES.includes(user.role)) {
      await this.assertRuleWrite(user, rule.vehicleImeis, 'edit');
      if (dto.vehicleImeis) await this.assertRuleWrite(user, dto.vehicleImeis, 'edit');
    }
    Object.assign(rule, dto, { id: rule.id, orgId: rule.orgId, excludedVehicleImeis: rule.excludedVehicleImeis });
    return this.repo.save(rule);
  }

  async remove(id: string, user: User): Promise<void> {
    if (ADMIN_ROLES.includes(user.role) && !['super_admin', 'admin', 'ops'].includes(user.role)) throw new ForbiddenException('Alert action not permitted');
    const rule = await this.getAccessibleRule(id, user);
    if (!ADMIN_ROLES.includes(user.role)) await this.assertRuleWrite(user, rule.vehicleImeis, 'delete');
    await this.repo.remove(rule);
  }

  private async getAccessibleRule(id: string, user: User): Promise<Alert> {
    const where = ADMIN_ROLES.includes(user.role) ? { id } : { id, orgId: user.organizationId ?? undefined };
    if (!ADMIN_ROLES.includes(user.role) && !user.organizationId) throw new ForbiddenException();
    const rule = await this.repo.findOne({ where });
    if (!rule) throw new NotFoundException('Alert rule not found');
    return rule;
  }

  private async assertVehicleAccess(user: User, imei: string, action: 'add' | 'edit' | 'delete'): Promise<void> {
    if (!user.organizationId || ADMIN_ROLES.includes(user.role)) throw new ForbiddenException();
    const permitted = await this.devices.findAll(user);
    const device = permitted.find(d => d.imei === imei);
    if (!device?.vehicle) throw new NotFoundException('Vehicle not found');
    const roleActions = (await this.rolePerms.findAll())[user.role]?.['alerts'];
    if (user.role === 'client_owner' || user.role === 'client_super_admin') {
      if (roleActions && !roleActions.includes(action)) throw new ForbiddenException('Alert action not permitted');
      return;
    }
    const orgPerm = await this.orgPerms.findByUser(user.id);
    if (orgPerm?.vehicleIds && !orgPerm.vehicleIds.includes(device.vehicle.id)) throw new ForbiddenException();
    const field = action === 'add' ? 'alertsAdd' : action === 'edit' ? 'alertsEdit' : 'alertsDelete';
    if (orgPerm ? !orgPerm[field] : !roleActions?.includes(action)) throw new ForbiddenException('Alert action not permitted');
  }

  private async assertRuleWrite(user: User, imeis: string[], action: 'add' | 'edit' | 'delete'): Promise<void> {
    if (!user.organizationId) throw new ForbiddenException();
    if (imeis.length) {
      for (const imei of new Set(imeis)) await this.assertVehicleAccess(user, imei, action);
      return;
    }
    const orgPerm = await this.orgPerms.findByUser(user.id);
    if (orgPerm?.vehicleIds !== undefined && orgPerm.vehicleIds !== null) throw new ForbiddenException('Fleet-wide alerts require access to all vehicles');
    const roleActions = (await this.rolePerms.findAll())[user.role]?.['alerts'];
    const field = action === 'add' ? 'alertsAdd' : action === 'edit' ? 'alertsEdit' : 'alertsDelete';
    if (orgPerm ? !orgPerm[field] : !roleActions?.includes(action)) throw new ForbiddenException('Alert action not permitted');
  }

  async findForVehicle(user: User, imei: string): Promise<Alert[]> {
    if (!user.organizationId || ADMIN_ROLES.includes(user.role)) throw new ForbiddenException();
    const devices = await this.devices.findAll(user);
    const device = devices.find(item => item.imei === imei);
    if (!device?.vehicle) throw new NotFoundException('Vehicle not found');
    const orgPerm = await this.orgPerms.findByUser(user.id);
    if (orgPerm?.vehicleIds && !orgPerm.vehicleIds.includes(device.vehicle.id)) throw new ForbiddenException();
    const roleActions = (await this.rolePerms.findAll())[user.role]?.['alerts'];
    if (orgPerm ? !orgPerm.alertsView : roleActions ? !roleActions.includes('view') : !['client_owner', 'client_super_admin'].includes(user.role)) throw new ForbiddenException();
    const rules = await this.findAll(user);
    return rules.filter(rule => !(rule.excludedVehicleImeis ?? []).includes(imei) && (!rule.vehicleImeis.length || rule.vehicleImeis.includes(imei)));
  }

  private vehiclePayload(dto: Partial<Alert>, imei: string): Partial<Alert> {
    if (!dto.name?.trim() || !dto.type) throw new BadRequestException('Name and alert type are required');
    return {
      name: dto.name.trim(), type: dto.type, active: dto.active ?? true,
      config: dto.config ?? {}, schedule: dto.schedule ?? null,
      notifications: dto.notifications ?? {}, vehicleImeis: [imei], excludedVehicleImeis: [],
    };
  }

  async createForVehicle(user: User, imei: string, dto: Partial<Alert>): Promise<Alert> {
    await this.assertVehicleAccess(user, imei, 'add');
    return this.repo.save(this.repo.create({ ...this.vehiclePayload(dto, imei), orgId: user.organizationId }));
  }

  async updateForVehicle(user: User, id: string, imei: string, dto: Partial<Alert>): Promise<Alert> {
    await this.assertVehicleAccess(user, imei, 'edit');
    const rule = await this.getAccessibleRule(id, user);
    if ((rule.excludedVehicleImeis ?? []).includes(imei) || (rule.vehicleImeis.length > 0 && !rule.vehicleImeis.includes(imei))) throw new NotFoundException('Alert rule not found for this vehicle');
    const payload = this.vehiclePayload(dto, imei);
    return this.dataSource.transaction(async manager => {
      const repo = manager.getRepository(Alert);
      const current = await repo.findOneOrFail({ where: { id: rule.id, orgId: user.organizationId! }, lock: { mode: 'pessimistic_write' } });
      if ((current.excludedVehicleImeis ?? []).includes(imei) || (current.vehicleImeis.length > 0 && !current.vehicleImeis.includes(imei))) throw new NotFoundException('Alert rule not found for this vehicle');
      if (current.vehicleImeis.length === 1 && current.vehicleImeis[0] === imei) return repo.save(Object.assign(current, payload));
      const isolated = await repo.save(repo.create({ ...payload, orgId: user.organizationId }));
      if (current.vehicleImeis.length === 0) current.excludedVehicleImeis = [...new Set([...(current.excludedVehicleImeis ?? []), imei])];
      else current.vehicleImeis = current.vehicleImeis.filter(value => value !== imei);
      await repo.save(current);
      return isolated;
    });
  }

  async removeForVehicle(user: User, id: string, imei: string): Promise<void> {
    await this.assertVehicleAccess(user, imei, 'delete');
    const rule = await this.getAccessibleRule(id, user);
    if ((rule.excludedVehicleImeis ?? []).includes(imei) || (rule.vehicleImeis.length > 0 && !rule.vehicleImeis.includes(imei))) throw new NotFoundException('Alert rule not found for this vehicle');
    await this.dataSource.transaction(async manager => {
      const repo = manager.getRepository(Alert);
      const current = await repo.findOneOrFail({ where: { id: rule.id, orgId: user.organizationId! }, lock: { mode: 'pessimistic_write' } });
      if ((current.excludedVehicleImeis ?? []).includes(imei) || (current.vehicleImeis.length > 0 && !current.vehicleImeis.includes(imei))) throw new NotFoundException('Alert rule not found for this vehicle');
      if (current.vehicleImeis.length === 1 && current.vehicleImeis[0] === imei) await repo.remove(current);
      else {
        if (current.vehicleImeis.length === 0) current.excludedVehicleImeis = [...new Set([...(current.excludedVehicleImeis ?? []), imei])];
        else current.vehicleImeis = current.vehicleImeis.filter(value => value !== imei);
        await repo.save(current);
      }
    });
  }

  async getLogs(user: User, alertId?: string, limit = 100): Promise<AlertLog[]> {
    const take = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 100, 500));
    if (ADMIN_ROLES.includes(user.role)) return this.logRepo.find({ where: alertId ? { alertId } : {}, order: { triggeredAt: 'DESC' }, take });
    const rules = alertId ? [await this.getAccessibleRule(alertId, user)] : await this.findAll(user);
    const imeis = (await this.devices.findAll(user)).map(device => device.imei);
    if (!rules.length || !imeis.length) return [];
    return this.logRepo.find({ where: { alertId: In(rules.map(rule => rule.id)), imei: In(imeis) }, order: { triggeredAt: 'DESC' }, take });
  }

  async logTrigger(alertId: string, imei: string, payload: Record<string, unknown>): Promise<void> {
    const log = this.logRepo.create({ alertId, imei, payload });
    await this.logRepo.save(log).catch(() => {});
  }
}
