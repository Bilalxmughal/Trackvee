import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpeedZone } from './entities/speed-zone.entity.js';
import { User } from '../users/entities/user.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@Injectable()
export class SpeedZonesService {
  constructor(@InjectRepository(SpeedZone) private repo: Repository<SpeedZone>) {}

  findAll(user: User, orgId?: string): Promise<SpeedZone[]> {
    if (ADMIN_ROLES.includes(user.role)) {
      if (orgId) return this.repo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    const resolvedOrgId = user.organizationId;
    if (!resolvedOrgId) return this.repo.find({ order: { createdAt: 'DESC' } });
    return this.repo.find({ where: { orgId: resolvedOrgId }, order: { createdAt: 'DESC' } });
  }

  findAllForOrg(orgId: string | null): Promise<SpeedZone[]> {
    if (!orgId) return this.repo.find({ order: { createdAt: 'DESC' } });
    return this.repo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
  }

  async create(user: User, dto: Partial<SpeedZone>, orgId?: string): Promise<SpeedZone> {
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : (user.organizationId ?? null);
    const z = this.repo.create({ ...dto, orgId: resolvedOrgId });
    return this.repo.save(z);
  }

  async update(id: string, dto: Partial<SpeedZone>): Promise<SpeedZone> {
    await this.repo.update(id, dto);
    const z = await this.repo.findOne({ where: { id } });
    if (!z) throw new NotFoundException();
    return z;
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
