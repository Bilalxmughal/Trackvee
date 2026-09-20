import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity.js';
import { User } from '../users/entities/user.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin'];

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private repo: Repository<Device>,
  ) {}

  findAll(user?: User, cityId?: string): Promise<Device[]> {
    const cityFilter = cityId ? { cityId } : {};
    if (!user || ADMIN_ROLES.includes(user.role)) {
      return this.repo.find({ relations: { vehicle: true }, where: cityFilter });
    }
    if (user.organizationId) {
      return this.repo.find({
        relations: { vehicle: true },
        where: { vehicle: { organizationId: user.organizationId }, ...cityFilter },
      });
    }
    return Promise.resolve([]);
  }

  async findByImei(imei: string): Promise<Device | null> {
    return this.repo.findOne({ where: { imei }, relations: { vehicle: true } });
  }

  async findOne(id: string): Promise<Device> {
    const device = await this.repo.findOne({ where: { id }, relations: { vehicle: true } });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async create(data: Partial<Device>): Promise<Device> {
    const device = this.repo.create(data);
    return this.repo.save(device);
  }

  async update(id: string, data: Partial<Device>): Promise<Device> {
    const device = await this.findOne(id);
    Object.assign(device, data);
    return this.repo.save(device);
  }

  async updateLastSeen(imei: string): Promise<void> {
    await this.repo.update({ imei }, { lastSeenAt: new Date(), status: 'active' });
  }

  async saveHeartbeat(imei: string, data: {
    ignition: boolean; externalPower: boolean; immobilizer: boolean;
    voltageLevel: number; gsmSignal: number;
  }): Promise<void> {
    await this.repo.update({ imei }, {
      lastIgnition: data.ignition,
      lastExternalPower: data.externalPower,
      lastImmobilizer: data.immobilizer,
      lastVoltageLevel: data.voltageLevel,
      lastGsmSignal: data.gsmSignal,
      lastSeenAt: new Date(),
      status: 'active',
    });
  }

  async getLastHeartbeat(imei: string): Promise<{
    ignition: boolean | null; externalPower: boolean | null;
    immobilizer: boolean | null; voltageLevel: number | null; gsmSignal: number | null;
  } | null> {
    const d = await this.repo.findOne({ where: { imei }, select: { lastIgnition: true, lastExternalPower: true, lastImmobilizer: true, lastVoltageLevel: true, lastGsmSignal: true } });
    if (!d || d.lastIgnition == null) return null;
    return {
      ignition: d.lastIgnition,
      externalPower: d.lastExternalPower,
      immobilizer: d.lastImmobilizer,
      voltageLevel: d.lastVoltageLevel,
      gsmSignal: d.lastGsmSignal,
    };
  }

  async remove(id: string): Promise<void> {
    const device = await this.findOne(id);
    await this.repo.remove(device);
  }
}
