import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './entities/alert.entity.js';
import { AlertLog } from './entities/alert-log.entity.js';
import { User } from '../users/entities/user.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert) private repo: Repository<Alert>,
    @InjectRepository(AlertLog) private logRepo: Repository<AlertLog>,
  ) {}

  findAll(user: User): Promise<Alert[]> {
    if (ADMIN_ROLES.includes(user.role)) return this.repo.find({ order: { createdAt: 'DESC' } });
    const orgId = user.organizationId;
    if (!orgId) return Promise.resolve([]);
    return this.repo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
  }

  // Returns active alerts for a given IMEI (used during telemetry evaluation)
  async findActiveForImei(imei: string, orgId: string | null): Promise<Alert[]> {
    const all = await this.repo.find({ where: { active: true } });
    return all.filter(a => {
      if (orgId && a.orgId && a.orgId !== orgId) return false;
      return a.vehicleImeis.length === 0 || a.vehicleImeis.includes(imei);
    });
  }

  async create(user: User, dto: Partial<Alert>): Promise<Alert> {
    const a = this.repo.create({ ...dto, orgId: user.organizationId ?? null });
    return this.repo.save(a);
  }

  async update(id: string, dto: Partial<Alert>): Promise<Alert> {
    await this.repo.update(id, dto as any);
    return this.repo.findOneOrFail({ where: { id } });
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async getLogs(alertId?: string, limit = 100): Promise<AlertLog[]> {
    const where = alertId ? { alertId } : {};
    return this.logRepo.find({ where, order: { triggeredAt: 'DESC' }, take: limit });
  }

  async logTrigger(alertId: string, imei: string, payload: Record<string, unknown>): Promise<void> {
    const log = this.logRepo.create({ alertId, imei, payload });
    await this.logRepo.save(log).catch(() => {});
  }
}
