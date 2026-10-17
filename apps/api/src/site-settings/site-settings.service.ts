import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSetting } from './entities/site-setting.entity.js';

@Injectable()
export class SiteSettingsService {
  constructor(
    @InjectRepository(SiteSetting)
    private repo: Repository<SiteSetting>,
  ) {}

  async getAll(): Promise<Record<string, unknown>> {
    const rows = await this.repo.find();
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  async get(key: string): Promise<Record<string, unknown> | null> {
    const row = await this.repo.findOne({ where: { key } });
    return (row?.value ?? null) as Record<string, unknown> | null;
  }

  async upsert(key: string, value: Record<string, unknown>): Promise<SiteSetting> {
    const existing = await this.repo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({ key, value }));
  }
}
