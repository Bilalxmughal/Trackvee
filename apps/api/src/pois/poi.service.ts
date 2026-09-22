import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Poi } from './entities/poi.entity.js';
import { User } from '../users/entities/user.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@Injectable()
export class PoisService {
  constructor(@InjectRepository(Poi) private repo: Repository<Poi>) {}

  findAll(user: User, orgId?: string): Promise<Poi[]> {
    if (ADMIN_ROLES.includes(user.role)) {
      if (orgId) return this.repo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    const resolvedOrgId = user.organizationId;
    if (!resolvedOrgId) return this.repo.find({ order: { createdAt: 'DESC' } });
    return this.repo.find({ where: { orgId: resolvedOrgId }, order: { createdAt: 'DESC' } });
  }

  async create(user: User, dto: Partial<Poi>, orgId?: string): Promise<Poi> {
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : (user.organizationId ?? null);
    const p = this.repo.create({ ...dto, orgId: resolvedOrgId });
    return this.repo.save(p);
  }

  async update(id: string, dto: Partial<Poi>): Promise<Poi> {
    await this.repo.update(id, dto);
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    return p;
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
