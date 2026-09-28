import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Geofence } from './entities/geofence.entity.js';
import { User } from '../users/entities/user.entity.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { assertClientFeatureAccess } from '../org-permissions/client-feature-access.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@Injectable()
export class GeofencesService {
  constructor(
    @InjectRepository(Geofence) private repo: Repository<Geofence>,
    private orgPermissions: OrgPermissionsService,
    private rolePermissions: RolePortalPermissionsService,
  ) {}

  async findAll(user: User, orgId?: string): Promise<Geofence[]> {
    if (ADMIN_ROLES.includes(user.role)) {
      if (orgId) return this.repo.find({ where: { orgId }, order: { createdAt: 'DESC' } });
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }
    await assertClientFeatureAccess(user, 'geofences', 'view', this.orgPermissions, this.rolePermissions);
    return this.repo.find({ where: { orgId: user.organizationId! }, order: { createdAt: 'DESC' } });
  }

  async create(user: User, dto: Partial<Geofence>, orgId?: string): Promise<Geofence> {
    if (!ADMIN_ROLES.includes(user.role)) await assertClientFeatureAccess(user, 'geofences', 'add', this.orgPermissions, this.rolePermissions);
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : user.organizationId!;
    const g = this.repo.create({
      name: dto.name,
      type: dto.type,
      coordinates: dto.coordinates,
      color: dto.color,
      triggerOnEnter: dto.triggerOnEnter,
      triggerOnExit: dto.triggerOnExit,
      orgId: resolvedOrgId,
    });
    return this.repo.save(g);
  }

  async update(id: string, dto: Partial<Geofence>, user: User): Promise<Geofence> {
    if (!ADMIN_ROLES.includes(user.role)) await assertClientFeatureAccess(user, 'geofences', 'edit', this.orgPermissions, this.rolePermissions);
    const geofence = await this.findAccessible(id, user);
    const changes = Object.fromEntries(Object.entries({
      name: dto.name,
      type: dto.type,
      coordinates: dto.coordinates,
      color: dto.color,
      triggerOnEnter: dto.triggerOnEnter,
      triggerOnExit: dto.triggerOnExit,
    }).filter(([, value]) => value !== undefined));
    Object.assign(geofence, changes);
    geofence.id = id;
    return this.repo.save(geofence);
  }

  async remove(id: string, user: User): Promise<void> {
    if (!ADMIN_ROLES.includes(user.role)) await assertClientFeatureAccess(user, 'geofences', 'delete', this.orgPermissions, this.rolePermissions);
    const geofence = await this.findAccessible(id, user);
    await this.repo.remove(geofence);
  }

  private async findAccessible(id: string, user: User): Promise<Geofence> {
    if (!ADMIN_ROLES.includes(user.role) && !user.organizationId) throw new ForbiddenException('Organization access required');
    const where = ADMIN_ROLES.includes(user.role) ? { id } : { id, orgId: user.organizationId! };
    const geofence = await this.repo.findOne({ where });
    if (!geofence) throw new NotFoundException('Geofence not found');
    return geofence;
  }
}
