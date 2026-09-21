import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolePortalPermission } from './role-portal-permission.entity.js';

@Injectable()
export class RolePortalPermissionsService {
  constructor(
    @InjectRepository(RolePortalPermission)
    private repo: Repository<RolePortalPermission>,
  ) {}

  async findAll(): Promise<Record<string, Record<string, string[]>>> {
    const rows = await this.repo.find();
    return Object.fromEntries(rows.map(r => [r.role, r.permissions]));
  }

  async updateAll(data: Record<string, Record<string, string[]>>): Promise<void> {
    for (const [role, permissions] of Object.entries(data)) {
      await this.repo.upsert({ role, permissions }, { conflictPaths: ['role'] });
    }
  }
}
