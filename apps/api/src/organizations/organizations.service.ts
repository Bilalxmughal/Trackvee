import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from './entities/organization.entity.js';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private repo: Repository<Organization>,
  ) {}

  findAll(): Promise<Organization[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<Organization> {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async create(data: Partial<Organization>, ownerId: string): Promise<Organization> {
    const base = (data.name ?? 'org').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let slug = base;
    let suffix = 1;
    while (await this.repo.findOne({ where: { slug } })) {
      slug = `${base}-${suffix++}`;
    }
    const org = this.repo.create({ ...data, slug, ownerId });
    return this.repo.save(org);
  }

  async remove(id: string): Promise<void> {
    const org = await this.findOne(id);
    await this.repo.remove(org);
  }

  async update(id: string, data: Partial<Organization>): Promise<Organization> {
    const org = await this.findOne(id);
    Object.assign(org, data);
    return this.repo.save(org);
  }
}
