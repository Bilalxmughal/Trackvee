import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Alert } from './entities/alert.entity.js';
import { AlertLog } from './entities/alert-log.entity.js';
import { User } from '../users/entities/user.entity.js';
import { DevicesService } from '../devices/devices.service.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { MobilePushToken } from './entities/mobile-push-token.entity.js';
import { NotificationSound } from './entities/notification-sound.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];
const PUSH_SOUND_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AlertWithAccess = Alert & { fleetWide?: boolean; canEdit?: boolean; canDelete?: boolean };

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert) private repo: Repository<Alert>,
    @InjectRepository(AlertLog) private logRepo: Repository<AlertLog>,
    private dataSource: DataSource,
    private devices: DevicesService,
    private orgPerms: OrgPermissionsService,
    private rolePerms: RolePortalPermissionsService,
    @InjectRepository(MobilePushToken) private pushTokenRepo: Repository<MobilePushToken>,
    @InjectRepository(NotificationSound) private notificationSoundRepo: Repository<NotificationSound>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  async findAll(user: User, orgId?: string): Promise<AlertWithAccess[]> {
    if (ADMIN_ROLES.includes(user.role)) {
      if (orgId) return this.repo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    if (!user.organizationId) throw new ForbiddenException();
    const [rolePermissions, orgPerm] = await Promise.all([
      this.rolePerms.findAll(),
      this.orgPerms.findByUser(user.id),
    ]);
    const roleActions = rolePermissions[user.role]?.alerts;
    const canView = orgPerm
      ? orgPerm.alertsView
      : (roleActions?.includes('view') ?? ['client_owner', 'client_super_admin'].includes(user.role));
    if (!canView) throw new ForbiddenException('Alert view not permitted');

    const [rules, devices] = await Promise.all([
      this.repo.find({ where: { orgId: user.organizationId }, order: { createdAt: 'DESC' } }),
      this.devices.findAll(user),
    ]);
    const visibleImeis = new Set(devices.map(device => device.imei));
    const hasAllVehicleAccess = ['client_owner', 'client_super_admin'].includes(user.role)
      || orgPerm?.vehicleIds == null;
    const hasAction = (action: 'edit' | 'delete') => {
      if (['client_owner', 'client_super_admin'].includes(user.role)) return roleActions ? roleActions.includes(action) : true;
      const key = action === 'edit' ? 'alertsEdit' : 'alertsDelete';
      return orgPerm ? orgPerm[key] : !!roleActions?.includes(action);
    };

    return rules.flatMap(rule => {
      const fleetWide = rule.vehicleImeis.length === 0;
      const excluded = new Set(rule.excludedVehicleImeis ?? []);
      const visibleTargets = fleetWide
        ? [...visibleImeis].filter(imei => !excluded.has(imei))
        : rule.vehicleImeis.filter(imei => visibleImeis.has(imei) && !excluded.has(imei));
      if (!visibleTargets.length) return [];
      const completeTargetScope = fleetWide ? hasAllVehicleAccess : visibleTargets.length === rule.vehicleImeis.length;
      return [{
        ...rule,
        vehicleImeis: fleetWide ? [] : visibleTargets,
        excludedVehicleImeis: [],
        fleetWide,
        canEdit: completeTargetScope && hasAction('edit'),
        canDelete: completeTargetScope && hasAction('delete'),
      }];
    });
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

  async getLogs(user: User, alertId?: string, limit = 100): Promise<Array<AlertLog & { alertName: string; alertType: string; vehiclePlate: string | null }>> {
    const take = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 100, 500));
    let logs: AlertLog[];
    let rulesMap: Map<string, Alert>;
    if (ADMIN_ROLES.includes(user.role)) {
      logs = await this.logRepo.find({ where: alertId ? { alertId } : {}, order: { triggeredAt: 'DESC' }, take });
      const alertIds = [...new Set(logs.map(l => l.alertId))];
      const rules = alertIds.length ? await this.repo.find({ where: { id: In(alertIds) } }) : [];
      rulesMap = new Map(rules.map(r => [r.id, r]));
    } else {
      const rules = alertId ? [await this.getAccessibleRule(alertId, user)] : await this.findAll(user);
      const userDevices = await this.devices.findAll(user);
      const imeis = userDevices.map(device => device.imei);
      if (!rules.length || !imeis.length) return [];
      logs = await this.logRepo.find({ where: { alertId: In(rules.map(rule => rule.id)), imei: In(imeis) }, order: { triggeredAt: 'DESC' }, take });
      rulesMap = new Map(rules.map(r => [r.id, r]));
      const deviceByImei = new Map(userDevices.map(d => [d.imei, d]));
      return logs.map(log => ({
        ...log,
        alertName: rulesMap.get(log.alertId)?.name ?? 'Alert',
        alertType: rulesMap.get(log.alertId)?.type ?? '',
        vehiclePlate: deviceByImei.get(log.imei)?.vehicle?.licensePlate ?? deviceByImei.get(log.imei)?.vehicle?.name ?? null,
      }));
    }
    return logs.map(log => ({
      ...log,
      alertName: rulesMap.get(log.alertId)?.name ?? 'Alert',
      alertType: rulesMap.get(log.alertId)?.type ?? '',
      vehiclePlate: null,
    }));
  }

  async registerPushToken(
    user: User,
    rawToken: unknown,
    rawPlatform: unknown,
    rawSupportsCustomSounds?: unknown,
    rawSupportsDynamicSounds?: unknown,
    rawDynamicSoundIds?: unknown,
    rawSoundEnabled?: unknown,
  ): Promise<{ registered: true }> {
    await this.assertMobileAlertsView(user);
    if (typeof rawToken !== 'string' || !/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/.test(rawToken)) {
      throw new BadRequestException('A valid Expo push token is required');
    }
    if (rawPlatform !== 'ios' && rawPlatform !== 'android') throw new BadRequestException('Unsupported mobile platform');
    const supportsCustomSounds = rawSupportsCustomSounds === true;
    const supportsDynamicSounds = rawSupportsDynamicSounds === true;
    if (rawDynamicSoundIds !== undefined && (!Array.isArray(rawDynamicSoundIds) || rawDynamicSoundIds.length > 100 || rawDynamicSoundIds.some(id => typeof id !== 'string' || !PUSH_SOUND_ID_RE.test(id)))) {
      throw new BadRequestException('Dynamic sound IDs are invalid');
    }
    const requestedSoundIds = supportsDynamicSounds ? [...new Set((rawDynamicSoundIds ?? []) as string[])] : [];
    const activeSoundIds = requestedSoundIds.length
      ? (await this.notificationSoundRepo.find({ where: { id: In(requestedSoundIds), isActive: true }, select: { id: true } })).map(sound => sound.id)
      : [];
    const orgId = user.organizationId;
    if (!orgId) throw new ForbiddenException();
    const existing = await this.pushTokenRepo.findOne({ where: { token: rawToken } });
    if (existing) {
      existing.userId = user.id;
      existing.organizationId = orgId;
      existing.platform = rawPlatform;
      existing.supportsCustomSounds = supportsCustomSounds;
      existing.supportsDynamicSounds = supportsDynamicSounds;
      existing.dynamicSoundIds = activeSoundIds;
      existing.soundEnabled = rawSoundEnabled !== false;
      await this.pushTokenRepo.save(existing);
    } else {
      await this.pushTokenRepo.save(this.pushTokenRepo.create({ userId: user.id, organizationId: orgId, token: rawToken, platform: rawPlatform, supportsCustomSounds, supportsDynamicSounds, dynamicSoundIds: activeSoundIds, soundEnabled: rawSoundEnabled !== false }));
    }
    return { registered: true };
  }

  async removePushToken(user: User, rawToken: unknown): Promise<{ removed: true }> {
    if (ADMIN_ROLES.includes(user.role) || !user.organizationId) throw new ForbiddenException('Client account is required');
    if (typeof rawToken !== 'string' || !/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/.test(rawToken)) {
      throw new BadRequestException('A valid Expo push token is required');
    }
    await this.pushTokenRepo.delete({ userId: user.id, token: rawToken });
    return { removed: true };
  }

  async updatePushTokenPreferences(user: User, rawToken: unknown, rawSoundEnabled: unknown): Promise<{ updated: true }> {
    await this.assertMobileAlertsView(user);
    if (typeof rawToken !== 'string' || !/^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/.test(rawToken)) {
      throw new BadRequestException('A valid Expo push token is required');
    }
    if (typeof rawSoundEnabled !== 'boolean' || !user.organizationId) throw new BadRequestException('A valid sound preference is required');
    const registration = await this.pushTokenRepo.findOne({ where: { userId: user.id, organizationId: user.organizationId, token: rawToken } });
    if (!registration) throw new NotFoundException('Push registration not found');
    registration.soundEnabled = rawSoundEnabled;
    await this.pushTokenRepo.save(registration);
    return { updated: true };
  }

  async getLogDetail(user: User, id: string) {
    if (!ADMIN_ROLES.includes(user.role)) await this.assertMobileAlertsView(user);
    const log = await this.logRepo.findOne({ where: { id } });
    if (!log) throw new NotFoundException('Alert event not found');
    const rule = await this.repo.findOne({ where: ADMIN_ROLES.includes(user.role) ? { id: log.alertId } : { id: log.alertId, orgId: user.organizationId ?? undefined } });
    if (!rule) throw new NotFoundException('Alert event not found');
    let vehicle: { id: string; name: string; licensePlate: string | null; make: string | null; model: string | null } | null = null;
    if (!ADMIN_ROLES.includes(user.role)) {
      const device = (await this.devices.findAll(user)).find(item => item.imei === log.imei);
      if (!device?.vehicle) throw new NotFoundException('Alert event not found');
      vehicle = { id: device.vehicle.id, name: device.vehicle.name, licensePlate: device.vehicle.licensePlate, make: device.vehicle.make, model: device.vehicle.model };
    } else {
      const device = await this.devices.findByImei(log.imei);
      if (device?.vehicle) vehicle = { id: device.vehicle.id, name: device.vehicle.name, licensePlate: device.vehicle.licensePlate, make: device.vehicle.make, model: device.vehicle.model };
    }
    return {
      id: log.id,
      alert: { id: rule.id, name: rule.name, type: rule.type },
      vehicle,
      imei: log.imei,
      triggeredAt: log.triggeredAt,
      payload: log.payload,
    };
  }

  private async assertMobileAlertsView(user: User): Promise<void> {
    if (ADMIN_ROLES.includes(user.role) || !user.organizationId) throw new ForbiddenException('Alerts access is required');
    const roleActions = (await this.rolePerms.findAll())[user.role]?.alerts;
    const orgPerm = await this.orgPerms.findByUser(user.id);
    const allowed = orgPerm ? orgPerm.alertsView : (roleActions?.includes('view') ?? ['client_owner', 'client_super_admin'].includes(user.role));
    if (!allowed) throw new ForbiddenException('Alerts access is required');
  }

  private async sendMobilePush(alert: Alert, log: AlertLog): Promise<void> {
    if (alert.notifications?.appPush !== true || !alert.orgId) return;
    try {
      const device = await this.devices.findByImei(log.imei);
      if (!device?.vehicle || device.vehicle.organizationId !== alert.orgId) return;
      const users = await this.usersRepo.find({ where: { organizationId: alert.orgId, isActive: true } });
      const rolePermissions = await this.rolePerms.findAll();
      const soundOptions = {
        trackvee: { file: 'trackvee_alert.wav', channel: 'trackvee-alerts-tone-trackvee-v1' },
        chime: { file: 'trackvee_chime.wav', channel: 'trackvee-alerts-tone-chime-v1' },
        pulse: { file: 'trackvee_pulse.wav', channel: 'trackvee-alerts-tone-pulse-v1' },
        bell: { file: 'trackvee_bell.wav', channel: 'trackvee-alerts-tone-bell-v1' },
        soft: { file: 'trackvee_soft.wav', channel: 'trackvee-alerts-tone-soft-v1' },
      } as const;
      const selectedSoundId = alert.notifications?.appSoundId ?? 'trackvee';
      const dynamicSound = PUSH_SOUND_ID_RE.test(selectedSoundId)
        ? await this.notificationSoundRepo.findOne({ where: { id: selectedSoundId, isActive: true } })
        : null;
      const messages: Array<{ to: string; title: string; body: string; sound?: string | null; priority: 'high'; channelId?: string; data: Record<string, string> }> = [];
      for (const recipient of users) {
        if (ADMIN_ROLES.includes(recipient.role)) continue;
        const roleCanView = rolePermissions[recipient.role]?.alerts?.includes('view') ?? ['client_owner', 'client_super_admin'].includes(recipient.role);
        const permission = await this.orgPerms.findByUser(recipient.id);
        if (permission ? !permission.alertsView : !roleCanView) continue;
        if (permission?.vehicleIds && !permission.vehicleIds.includes(device.vehicle.id)) continue;
        const registrations = await this.pushTokenRepo.find({ where: { userId: recipient.id, organizationId: alert.orgId } });
        for (const registration of registrations) {
          const soundEnabled = alert.notifications?.appSound !== false && registration.soundEnabled !== false;
          const selected = soundOptions[selectedSoundId as keyof typeof soundOptions] ?? soundOptions.trackvee;
          const modern = registration.supportsCustomSounds === true;
          const dynamicAvailable = modern && registration.supportsDynamicSounds === true && !!dynamicSound && registration.dynamicSoundIds?.includes(dynamicSound.id);
          messages.push({
            to: registration.token,
            title: alert.name,
            body: `${device.vehicle.licensePlate || device.vehicle.name} · ${alert.type === 'maintenance' ? `${String(log.payload['serviceType'] ?? 'Maintenance')} ${String(log.payload['maintenanceStatus'] ?? 'due')}` : alert.type.replaceAll('_', ' ')}`,
            ...(soundEnabled
              ? modern && dynamicAvailable
                ? registration.platform === 'ios'
                  ? { sound: dynamicSound.fileName }
                  : { sound: dynamicSound.fileName, channelId: `trackvee-alerts-dyn-${dynamicSound.id.replaceAll('-', '')}` }
                : modern
                  ? { sound: selected.file, channelId: selected.channel }
                  : { sound: 'trackvee_alert.wav', channelId: 'trackvee-alerts-custom-v1' }
              : modern
                ? { sound: null, channelId: 'trackvee-alerts-silent-v1' }
                : { sound: 'trackvee_alert.wav', channelId: 'trackvee-alerts-custom-v1' }),
            priority: 'high',
            data: { path: `/notification/${log.id}`, logId: log.id },
          });
        }
      }
      for (let start = 0; start < messages.length; start += 100) {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
          body: JSON.stringify(messages.slice(start, start + 100)),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          this.logger.warn(`Expo push request failed with HTTP ${response.status}`);
          continue;
        }
        const result = await response.json() as { data?: Array<{ status?: string; details?: { error?: string } }> };
        const receipts = result.data ?? [];
        const rejectionCodes = [...new Set(receipts.flatMap(receipt => receipt.status === 'error' && receipt.details?.error ? [receipt.details.error] : []))];
        if (rejectionCodes.length) this.logger.warn(`Expo rejected push messages: ${rejectionCodes.join(', ')}`);
        const invalid = receipts.flatMap((receipt, index) => receipt.status === 'error' && receipt.details?.error === 'DeviceNotRegistered' ? [messages[start + index]?.to] : []).filter((token): token is string => !!token);
        if (invalid.length) await this.pushTokenRepo.delete({ token: In(invalid) });
      }
    } catch (error) {
      // Push delivery must never interrupt telemetry ingestion or event persistence.
      this.logger.error(`Mobile push delivery failed (${error instanceof Error ? error.name : 'UnknownError'})`);
    }
  }

  async logTrigger(alertId: string, imei: string, payload: Record<string, unknown>): Promise<void> {
    const log = this.logRepo.create({ alertId, imei, payload });
    const saved = await this.logRepo.save(log).catch(error => {
      this.logger.error(`Alert event could not be persisted (${error instanceof Error ? error.name : 'UnknownError'})`);
      return null;
    });
    const alert = saved ? await this.repo.findOne({ where: { id: alertId } }).catch(error => {
      this.logger.error(`Triggered alert rule could not be loaded (${error instanceof Error ? error.name : 'UnknownError'})`);
      return null;
    }) : null;
    if (alert && saved) void this.sendMobilePush(alert, saved);
  }

  async hasMaintenanceTrigger(alertId: string, imei: string, maintenanceRecordId: string): Promise<boolean> {
    return (await this.logRepo.createQueryBuilder('log')
      .where('log.alert_id = :alertId', { alertId })
      .andWhere('log.imei = :imei', { imei })
      .andWhere("log.payload ->> 'maintenanceRecordId' = :maintenanceRecordId", { maintenanceRecordId })
      .getExists());
  }
}
