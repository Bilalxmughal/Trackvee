import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Geofence } from './entities/geofence.entity.js';
import { User } from '../users/entities/user.entity.js';

@Injectable()
export class GeofencesService {
  constructor(@InjectRepository(Geofence) private repo: Repository<Geofence>) {}

  findAll(user: User): Promise<Geofence[]> {
    const orgId = user.organizationId;
    if (!orgId) return this.repo.find({ order: { createdAt: 'DESC' } });
    return this.repo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
  }

  async create(user: User, dto: Partial<Geofence>): Promise<Geofence> {
    const g = this.repo.create({ ...dto, orgId: user.organizationId ?? null });
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
