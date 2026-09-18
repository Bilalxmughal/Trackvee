import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Telemetry } from './entities/telemetry.entity.js';
import { DevicesService } from '../devices/devices.service.js';
import { User } from '../users/entities/user.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin'];

@Injectable()
export class TelemetryService {
  constructor(
    @InjectRepository(Telemetry)
    private repo: Repository<Telemetry>,
    private devicesService: DevicesService,
  ) {}

  async findRecent(user: User, limit = 100): Promise<Telemetry[]> {
    if (ADMIN_ROLES.includes(user.role)) {
      return this.repo.find({ order: { timestamp: 'DESC' }, take: limit });
    }
    if (user.organizationId) {
      const devices = await this.devicesService.findAll(user);
      const imeis = devices.map(d => d.imei);
      if (!imeis.length) return [];
      return this.repo.find({ where: { imei: In(imeis) }, order: { timestamp: 'DESC' }, take: limit });
    }
    return [];
  }

  async save(data: Partial<Telemetry>): Promise<Telemetry> {
    const record = this.repo.create(data);
    return this.repo.save(record);
  }

  async getLatest(imei: string): Promise<Telemetry | null> {
    return this.repo.findOne({
      where: { imei },
      order: { timestamp: 'DESC' },
    });
  }

  async getHistory(imei: string, limit = 100): Promise<Telemetry[]> {
    return this.repo.find({
      where: { imei },
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }

  async getLiveLocations(user: User): Promise<Telemetry[]> {
    let imeis: string[] | null = null;

    if (!ADMIN_ROLES.includes(user.role) && user.organizationId) {
      const devices = await this.devicesService.findAll(user);
      imeis = devices.map(d => d.imei);
      if (!imeis.length) return [];
    }

    const sub = this.repo
      .createQueryBuilder('t')
      .select('t.imei', 'imei')
      .addSelect('MAX(t.timestamp)', 'max_ts')
      .groupBy('t.imei');

    if (imeis) sub.where('t.imei IN (:...imeis)', { imeis });

    const rows = await sub.getRawMany<{ imei: string; max_ts: string }>();
    if (!rows.length) return [];

    const results = await Promise.all(
      rows.map(r => this.repo.findOne({ where: { imei: r.imei, timestamp: new Date(r.max_ts) } }))
    );
    return results.filter((r): r is Telemetry => r !== null);
  }
}
