import { Injectable, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'node:crypto';
import { ShareLink } from './entities/share-link.entity.js';
import { TelemetryService } from '../telemetry/telemetry.service.js';
import { DevicesService } from '../devices/devices.service.js';
import { User } from '../users/entities/user.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@Injectable()
export class ShareLinksService {
  constructor(
    @InjectRepository(ShareLink) private repo: Repository<ShareLink>,
    private telemetryService: TelemetryService,
    private devicesService: DevicesService,
  ) {}

  private generateToken(): string {
    return randomBytes(8).toString('base64url').slice(0, 10);
  }

  async findAll(user: User): Promise<ShareLink[]> {
    const where = ADMIN_ROLES.includes(user.role)
      ? {}
      : { orgId: user.organizationId ?? undefined };
    return this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  async create(user: User, dto: { name: string; imei: string; expiresAt?: string | null }): Promise<ShareLink> {
    let token: string;
    let tries = 0;
    do {
      token = this.generateToken();
      tries++;
      if (tries > 20) throw new Error('Failed to generate unique token');
    } while (await this.repo.findOne({ where: { token } }));

    if (!user.organizationId) throw new Error('User has no organization');
    const link = this.repo.create({
      token,
      name: dto.name,
      imei: dto.imei,
      orgId: user.organizationId,
      createdById: user.id,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      isActive: true,
      viewCount: 0,
    });
    return this.repo.save(link);
  }

  async update(id: string, user: User, dto: { name?: string; expiresAt?: string | null; isActive?: boolean }): Promise<ShareLink> {
    const link = await this.findOneOwned(id, user);
    if (dto.name !== undefined) link.name = dto.name;
    if ('expiresAt' in dto) link.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (dto.isActive !== undefined) link.isActive = dto.isActive;
    return this.repo.save(link);
  }

  async remove(id: string, user: User): Promise<void> {
    const link = await this.findOneOwned(id, user);
    await this.repo.remove(link);
  }

  async getLiveData(token: string) {
    const link = await this.repo.findOne({ where: { token } });
    if (!link || !link.isActive) throw new UnauthorizedException('Share link not found or inactive');
    if (link.expiresAt && new Date() > link.expiresAt) throw new UnauthorizedException('Share link expired');

    await this.repo.increment({ id: link.id }, 'viewCount', 1);

    const device = await this.devicesService.findByImei(link.imei);
    const latest = device ? await this.telemetryService.getLatest(link.imei) : null;

    return {
      name: link.name,
      vehicle: device?.vehicle
        ? { id: device.vehicle.id, licensePlate: device.vehicle.licensePlate, name: device.vehicle.name, make: device.vehicle.make, model: device.vehicle.model }
        : null,
      point: latest,
    };
  }

  private async findOneOwned(id: string, user: User): Promise<ShareLink> {
    const link = await this.repo.findOne({ where: { id } });
    if (!link) throw new NotFoundException('Share link not found');
    if (!ADMIN_ROLES.includes(user.role) && link.orgId !== user.organizationId) {
      throw new ForbiddenException();
    }
    return link;
  }
}
