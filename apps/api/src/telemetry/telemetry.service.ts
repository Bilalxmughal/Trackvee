import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telemetry } from './entities/telemetry.entity.js';

@Injectable()
export class TelemetryService {
  constructor(
    @InjectRepository(Telemetry)
    private repo: Repository<Telemetry>,
  ) {}

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
}
