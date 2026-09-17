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

  async create(data: Partial<Organization>): Promise<Organization> {
    const org = this.repo.create(data);
    return this.repo.save(org);
  }

  async update(id: string, data: Partial<Organization>): Promise<Organization> {
    const org = await this.findOne(id);
    Object.assign(org, data);
    return this.repo.save(org);
  }
}
