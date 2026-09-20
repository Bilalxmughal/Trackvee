import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Poi } from './entities/poi.entity.js';
import { User } from '../users/entities/user.entity.js';

@Injectable()
export class PoisService {
  constructor(@InjectRepository(Poi) private repo: Repository<Poi>) {}

  findAll(user: User): Promise<Poi[]> {
    const orgId = user.organizationId;
    if (!orgId) return this.repo.find({ order: { createdAt: 'DESC' } });
    return this.repo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
  }

  async create(user: User, dto: Partial<Poi>): Promise<Poi> {
    const p = this.repo.create({ ...dto, orgId: user.organizationId ?? null });
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
