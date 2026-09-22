import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Geofence } from './entities/geofence.entity.js';
import { User } from '../users/entities/user.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@Injectable()
export class GeofencesService {
  constructor(@InjectRepository(Geofence) private repo: Repository<Geofence>) {}

  findAll(user: User, orgId?: string): Promise<Geofence[]> {
    if (ADMIN_ROLES.includes(user.role)) {
      if (orgId) return this.repo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    const resolvedOrgId = user.organizationId;
    if (!resolvedOrgId) return this.repo.find({ order: { createdAt: 'DESC' } });
    return this.repo.find({ where: { orgId: resolvedOrgId }, order: { createdAt: 'DESC' } });
  }

  async create(user: User, dto: Partial<Geofence>, orgId?: string): Promise<Geofence> {
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : (user.organizationId ?? null);
    const g = this.repo.create({ ...dto, orgId: resolvedOrgId });
    return this.repo.save(g);
  }

  async update(id: string, dto: Partial<Geofence>): Promise<Geofence> {
    await this.repo.update(id, dto);
    const g = await this.repo.findOne({ where: { id } });
    if (!g) throw new NotFoundException();
    return g;
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
