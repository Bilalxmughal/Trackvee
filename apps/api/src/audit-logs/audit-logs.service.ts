import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, ILike } from 'typeorm';
import { AuditLog, AuditAction } from './entities/audit-log.entity.js';
import { User } from '../users/entities/user.entity.js';

export interface AuditCtx {
  user?: User | null;
  orgId?: string | null;
  orgName?: string | null;
  ip?: string;
}

export interface AuditLogEntry {
  action: AuditAction;
  entityType: string;
  entityId?: string;
  entityName?: string;
  details?: Record<string, unknown>;
  status?: 'success' | 'failed';
}

export interface AuditFilter {
  action?: string;
  entityType?: string;
  userId?: string;
  orgId?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditLogsService {
  constructor(
    @InjectRepository(AuditLog)
    private repo: Repository<AuditLog>,
  ) {}

  async log(ctx: AuditCtx, entry: AuditLogEntry): Promise<void> {
    try {
      const user = ctx.user;
      const record = this.repo.create({
        userId:     user?.id ?? null,
        userEmail:  user?.email ?? null,
        userName:   user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : null,
        userRole:   user?.role ?? null,
        orgId:      ctx.orgId ?? user?.organizationId ?? null,
        orgName:    ctx.orgName ?? null,
        action:     entry.action,
        entityType: entry.entityType,
        entityId:   entry.entityId ?? null,
        entityName: entry.entityName ?? null,
        details:    entry.details ?? null,
        ip:         ctx.ip ?? null,
        status:     entry.status ?? 'success',
      });
      await this.repo.save(record);
    } catch { /* never fail the main operation */ }
  }

  async findAll(filter: AuditFilter): Promise<{ data: AuditLog[]; total: number }> {
    const qb = this.repo.createQueryBuilder('al').orderBy('al.timestamp', 'DESC');

    if (filter.action)     qb.andWhere('al.action = :action', { action: filter.action });
    if (filter.entityType) qb.andWhere('al.entity_type = :et', { et: filter.entityType });
    if (filter.userId)     qb.andWhere('al.user_id = :uid', { uid: filter.userId });
    if (filter.orgId)      qb.andWhere('al.org_id = :oid', { oid: filter.orgId });
    if (filter.status)     qb.andWhere('al.status = :status', { status: filter.status });

    if (filter.search) {
      const s = `%${filter.search}%`;
      qb.andWhere(
        '(al.entity_name ILIKE :s OR al.user_email ILIKE :s OR al.user_name ILIKE :s OR al.entity_id ILIKE :s)',
        { s },
      );
    }

    if (filter.from) qb.andWhere('al.timestamp >= :from', { from: new Date(filter.from) });
    if (filter.to)   qb.andWhere('al.timestamp <= :to',   { to: new Date(filter.to) });

    const total = await qb.getCount();
    const data  = await qb.skip(filter.offset ?? 0).take(filter.limit ?? 50).getMany();
    return { data, total };
  }

  async getActors(): Promise<{ id: string; email: string; name: string }[]> {
    const rows = await this.repo
      .createQueryBuilder('al')
      .select('al.user_id', 'id')
      .addSelect('al.user_email', 'email')
      .addSelect('al.user_name', 'name')
      .where('al.user_id IS NOT NULL')
      .groupBy('al.user_id, al.user_email, al.user_name')
      .orderBy('al.user_email', 'ASC')
      .getRawMany();
    return rows;
  }

  toCsv(logs: AuditLog[]): string {
    const headers = ['Timestamp', 'Action', 'Entity Type', 'Entity Name', 'Entity ID', 'User', 'Role', 'Client', 'Status', 'IP', 'Details'];
    const rows = logs.map(l => [
      new Date(l.timestamp).toISOString(),
      l.action,
      l.entityType,
      l.entityName ?? '',
      l.entityId ?? '',
      l.userEmail ?? '',
      l.userRole ?? '',
      l.orgName ?? '',
      l.status,
      l.ip ?? '',
      l.details ? JSON.stringify(l.details) : '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    return [headers.join(','), ...rows].join('\n');
  }
}
