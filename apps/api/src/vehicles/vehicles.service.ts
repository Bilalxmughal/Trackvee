import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity.js';
import { User } from '../users/entities/user.entity.js';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private repo: Repository<Vehicle>,
  ) {}

  async findForUser(user: User): Promise<Vehicle[]> {
    if (user.role === 'super_admin' || user.role === 'admin') {
      return this.repo.find();
    }
    if (user.organizationId) {
      return this.repo.find({ where: { organizationId: user.organizationId } });
    }
    return this.repo.find({ where: { ownerId: user.id } });
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

  private assertAccess(vehicle: Vehicle, user: User): void {
    if (user.role === 'super_admin' || user.role === 'admin') return;
    if (user.organizationId && vehicle.organizationId === user.organizationId) return;
    if (vehicle.ownerId === user.id) return;
    throw new ForbiddenException();
  }
}
