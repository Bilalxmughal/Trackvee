import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Poi } from './entities/poi.entity.js';
import { User } from '../users/entities/user.entity.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { assertClientFeatureAccess } from '../org-permissions/client-feature-access.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@Injectable()
export class PoisService {
  constructor(
    @InjectRepository(Poi) private repo: Repository<Poi>,
    private orgPermissions: OrgPermissionsService,
    private rolePermissions: RolePortalPermissionsService,
  ) {}

  async findAll(user: User, orgId?: string): Promise<Poi[]> {
    if (ADMIN_ROLES.includes(user.role)) {
      if (orgId) return this.repo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    await assertClientFeatureAccess(user, 'pois', 'view', this.orgPermissions, this.rolePermissions);
    return this.repo.find({ where: { orgId: user.organizationId! }, order: { createdAt: 'DESC' } });
  }

  async create(user: User, dto: Partial<Poi>, orgId?: string): Promise<Poi> {
    if (!ADMIN_ROLES.includes(user.role)) await assertClientFeatureAccess(user, 'pois', 'add', this.orgPermissions, this.rolePermissions);
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : user.organizationId!;
    const p = this.repo.create({
      name: dto.name,
      description: dto.description,
      group: dto.group,
      icon: dto.icon,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radius: dto.radius,
      orgId: resolvedOrgId,
    });
    return this.repo.save(p);
  }

  async update(id: string, dto: Partial<Poi>, user: User): Promise<Poi> {
    if (!ADMIN_ROLES.includes(user.role)) await assertClientFeatureAccess(user, 'pois', 'edit', this.orgPermissions, this.rolePermissions);
    const poi = await this.findAccessible(id, user);
    const changes = Object.fromEntries(Object.entries({
      name: dto.name,
      description: dto.description,
      group: dto.group,
      icon: dto.icon,
      latitude: dto.latitude,
      longitude: dto.longitude,
      radius: dto.radius,
    }).filter(([, value]) => value !== undefined));
    Object.assign(poi, changes);
    poi.id = id;
    return this.repo.save(poi);
  }

  async remove(id: string, user: User): Promise<void> {
    if (!ADMIN_ROLES.includes(user.role)) await assertClientFeatureAccess(user, 'pois', 'delete', this.orgPermissions, this.rolePermissions);
    const poi = await this.findAccessible(id, user);
    await this.repo.remove(poi);
  }

  private async findAccessible(id: string, user: User): Promise<Poi> {
    if (!ADMIN_ROLES.includes(user.role) && !user.organizationId) throw new ForbiddenException('Organization access required');
    const where = ADMIN_ROLES.includes(user.role) ? { id } : { id, orgId: user.organizationId! };
    const poi = await this.repo.findOne({ where });
    if (!poi) throw new NotFoundException('POI not found');
    return poi;
  }
}
