import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Put, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrgPermissionsService, OrgPermDto } from './org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { INTERNAL_ROLES, assertClientFeatureAccess, validateOrgPermissionGrant } from './client-feature-access.js';

const INTERNAL_PERMISSION_ROLES = new Set(['super_admin', 'admin', 'ops']);

@UseGuards(JwtAuthGuard)
@Controller('org-permissions')
export class OrgPermissionsController {
  constructor(
    private svc: OrgPermissionsService,
    private rolePerms: RolePortalPermissionsService,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
  ) {}

  private async targetFor(userId: string): Promise<User> {
    const target = await this.users.findOne({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    return target;
  }

  @Get('summary')
  async summary(@CurrentUser() caller: User, @Query('organizationId') organizationId?: string) {
    if (!INTERNAL_PERMISSION_ROLES.has(caller.role)) throw new ForbiddenException();
    return this.svc.findByOrg(organizationId);
  }

  @Get(':userId')
  async findOne(@CurrentUser() caller: User, @Param('userId') userId: string) {
    const target = await this.targetFor(userId);
    if (INTERNAL_PERMISSION_ROLES.has(caller.role)) {
      return this.svc.findByUser(target.id);
    }
    if (!INTERNAL_ROLES.has(caller.role)) {
      if (!caller.organizationId || caller.organizationId !== target.organizationId) throw new ForbiddenException();
      if (caller.id !== target.id) {
        await this.assertManageableTarget(caller, target);
        await assertClientFeatureAccess(caller, 'users', 'view', this.svc, this.rolePerms);
      }
    } else throw new ForbiddenException();
    return this.svc.findByUser(target.id);
  }

  @Put(':userId')
  async upsert(@CurrentUser() caller: User, @Param('userId') userId: string, @Body() dto: OrgPermDto & { orgId?: string }) {
    const target = await this.targetFor(userId);
    if (!target.organizationId) throw new ForbiddenException();
    if (dto.orgId && dto.orgId !== target.organizationId) throw new ForbiddenException();
    if (!INTERNAL_PERMISSION_ROLES.has(caller.role)) {
      if (INTERNAL_ROLES.has(caller.role)) throw new ForbiddenException();
      await this.assertManageableTarget(caller, target);
      await validateOrgPermissionGrant(caller, target, dto, 'edit', this.svc, this.rolePerms, async ids => {
        if (!ids.length) return [];
        const rows = await this.vehicles.find({ where: { organizationId: caller.organizationId!, id: In(ids) }, select: { id: true } });
        return rows.map(row => row.id);
      });
    }
    const allowed = ['dashboardView', 'mapView', 'vehiclesView', 'vehiclesAdd', 'vehiclesEdit', 'vehiclesDelete', 'alertsView', 'alertsAdd', 'alertsEdit', 'alertsDelete', 'geofencesView', 'geofencesAdd', 'geofencesEdit', 'geofencesDelete', 'poisView', 'poisAdd', 'poisEdit', 'poisDelete', 'driverBehaviorView', 'driverBehaviorEdit', 'reportsView', 'usersView', 'usersAdd', 'usersEdit', 'usersDelete', 'maintenanceView', 'maintenanceAdd', 'maintenanceEdit', 'maintenanceDelete'] as const;
    const perms: OrgPermDto = {};
    const nullable = new Set(['dashboardView', 'mapView', 'driverBehaviorView', 'driverBehaviorEdit', 'reportsView', 'usersView', 'usersAdd', 'usersEdit', 'usersDelete', 'maintenanceView', 'maintenanceAdd', 'maintenanceEdit', 'maintenanceDelete']);
    for (const key of allowed) {
      if (typeof dto[key] === 'boolean') perms[key] = dto[key];
      else if (nullable.has(key) && dto[key] === null) (perms as unknown as Record<string, boolean | null>)[key] = null;
    }
    if (dto.vehicleIds === null || (Array.isArray(dto.vehicleIds) && dto.vehicleIds.every(value => typeof value === 'string'))) perms.vehicleIds = dto.vehicleIds;
    return this.svc.upsert(target.id, target.organizationId, perms);
  }

  private async assertManageableTarget(caller: User, target: User): Promise<void> {
    const levels: Record<string, number> = { client_owner: 4, client_super_admin: 3, client_admin: 2, client_user: 1 };
    if (!caller.organizationId || caller.organizationId !== target.organizationId || caller.id === target.id ||
      !levels[target.role] || target.role === 'client_owner' || levels[target.role]! >= (levels[caller.role] ?? 0)) {
      throw new ForbiddenException('You cannot manage this user');
    }
  }
}
