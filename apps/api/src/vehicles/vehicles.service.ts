import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity.js';
import { Device } from '../devices/entities/device.entity.js';
import { User } from '../users/entities/user.entity.js';

const GATEWAY_CMD_URL = process.env['GATEWAY_CMD_URL'] ?? 'http://localhost:5024';
const INTERNAL_KEY = process.env['INTERNAL_API_KEY'] ?? '';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private repo: Repository<Vehicle>,
    @InjectRepository(Device)
    private deviceRepo: Repository<Device>,
  ) {}

  async findForUser(user: User, cityId?: string): Promise<Vehicle[]> {
    const cityFilter = cityId ? { cityId } : {};
    if (user.role === 'super_admin' || user.role === 'admin') {
      return this.repo.find({ where: cityFilter });
    }
    if (user.organizationId) {
      return this.repo.find({ where: { organizationId: user.organizationId, ...cityFilter } });
    }
    return this.repo.find({ where: { ownerId: user.id, ...cityFilter } });
  }

  async findOne(id: string, user: User): Promise<Vehicle> {
    const vehicle = await this.repo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    this.assertAccess(vehicle, user);
    return vehicle;
  }

  async create(data: Partial<Vehicle>, user: User): Promise<Vehicle> {
    const autoName = [data.make, data.model, data.licensePlate].filter(Boolean).join(' ') || 'Vehicle';
    const vehicle = this.repo.create({
      ...data,
      name: data.name || autoName,
      ownerId: user.id,
      organizationId: data.organizationId ?? user.organizationId ?? null,
    });
    return this.repo.save(vehicle);
  }

  async update(id: string, data: Partial<Vehicle>, user: User): Promise<Vehicle> {
    const vehicle = await this.findOne(id, user);
    Object.assign(vehicle, data);
    return this.repo.save(vehicle);
  }

  async remove(id: string, user: User): Promise<void> {
    const vehicle = await this.findOne(id, user);
    await this.repo.remove(vehicle);
  }

  async sendCommand(vehicleId: string, action: 'immobilize' | 'activate', user: User): Promise<{ sent: boolean; connected: boolean }> {
    const vehicle = await this.findOne(vehicleId, user);
    const device = await this.deviceRepo.findOne({ where: { vehicleId: vehicle.id } });
    if (!device) throw new BadRequestException('No device assigned to this vehicle');

    const command = action === 'immobilize' ? 'DYD#' : 'HFYD#';
    const res = await fetch(`${GATEWAY_CMD_URL}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_KEY },
      body: JSON.stringify({ imei: device.imei, command }),
    }).catch(() => null);

    if (!res) return { sent: false, connected: false };
    const data = await res.json() as { sent: boolean; connected: boolean };
    return data;
  }

  private assertAccess(vehicle: Vehicle, user: User): void {
    if (user.role === 'super_admin' || user.role === 'admin') return;
    if (user.organizationId && vehicle.organizationId === user.organizationId) return;
    if (vehicle.ownerId === user.id) return;
    throw new ForbiddenException();
  }
}
