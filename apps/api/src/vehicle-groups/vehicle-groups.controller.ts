import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { VehicleGroupsService } from './vehicle-groups.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { assertClientFeatureAccess, effectiveClientActions, INTERNAL_ROLES } from '../org-permissions/client-feature-access.js';


@ApiTags('vehicle-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicle-groups')
export class VehicleGroupsController {
  constructor(
    private svc: VehicleGroupsService,
    private orgPermissions: OrgPermissionsService,
    private rolePermissions: RolePortalPermissionsService,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
  ) {}

  @Get()
  async list(@CurrentUser() user: User, @Query('orgId') orgId?: string) {
    const resolvedOrgId = this.resolveOrgId(user, orgId);
    if (!resolvedOrgId) return [];
    if (INTERNAL_ROLES.has(user.role)) return this.svc.listGroups(resolvedOrgId);
    await this.assertView(user);
    const accessible = new Set((await this.accessibleVehicleIds(user)).ids);
    return (await this.svc.listGroups(resolvedOrgId)).map(group => ({
      ...group,
      vehicleIds: group.vehicleIds.filter(id => accessible.has(id)),
    }));
  }

  @Post()
  async create(
    @CurrentUser() user: User,
    @Query('orgId') orgId: string | undefined,
    @Body() body: { name: string; vehicleIds: string[] },
  ) {
    const resolvedOrgId = this.resolveOrgId(user, orgId);
    if (!resolvedOrgId) return null;
    if (!INTERNAL_ROLES.has(user.role)) {
      await assertClientFeatureAccess(user, 'vehicles', 'add', this.orgPermissions, this.rolePermissions);
      await this.assertSelectedVehicles(user, body.vehicleIds ?? []);
    }
    return this.svc.createGroup(resolvedOrgId, body.name, body.vehicleIds ?? []);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('orgId') orgId: string | undefined,
    @Body() body: { name: string; vehicleIds: string[] },
  ) {
    const resolvedOrgId = this.resolveOrgId(user, orgId);
    if (!resolvedOrgId) return null;
    if (!INTERNAL_ROLES.has(user.role)) {
      await assertClientFeatureAccess(user, 'vehicles', 'edit', this.orgPermissions, this.rolePermissions);
      await this.assertSelectedVehicles(user, body.vehicleIds ?? [], id);
    }
    return this.svc.updateGroup(id, resolvedOrgId, body.name, body.vehicleIds ?? []);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('orgId') orgId: string | undefined,
  ) {
    const resolvedOrgId = this.resolveOrgId(user, orgId);
    if (!resolvedOrgId) return null;
    if (!INTERNAL_ROLES.has(user.role)) {
      await assertClientFeatureAccess(user, 'vehicles', 'delete', this.orgPermissions, this.rolePermissions);
      const group = (await this.svc.listGroups(resolvedOrgId)).find(row => row.id === id);
      if (!group) throw new ForbiddenException();
      const scope = await this.accessibleVehicleIds(user);
      if (scope.all !== null && group.vehicleIds.some(vehicleId => !scope.all!.includes(vehicleId))) throw new ForbiddenException('This group contains vehicles outside your access');
    }
    return this.svc.deleteGroup(id, resolvedOrgId);
  }

  private async assertView(user: User): Promise<void> {
    const [vehicle, map] = await Promise.all([
      effectiveClientActions(user, 'vehicles', this.orgPermissions, this.rolePermissions),
      effectiveClientActions(user, 'map', this.orgPermissions, this.rolePermissions),
    ]);
    if (!vehicle.includes('view') && !map.includes('view')) throw new ForbiddenException('Vehicle group view permission required');
  }

  private async accessibleVehicleIds(user: User): Promise<{ ids: string[]; all: string[] | null }> {
    if (!user.organizationId) throw new ForbiddenException('Organization access required');
    if (user.role === 'client_owner') {
      const rows = await this.vehicles.find({ where: { organizationId: user.organizationId }, select: { id: true } });
      return { ids: rows.map(row => row.id), all: null };
    }
    const permission = await this.orgPermissions.findByUser(user.id);
    if (permission && permission.orgId !== user.organizationId) throw new ForbiddenException();
    const all = permission?.vehicleIds ?? null;
    if (all !== null) return { ids: all, all };
    const rows = await this.vehicles.find({ where: { organizationId: user.organizationId }, select: { id: true } });
    const ids = rows.map(row => row.id);
    return { ids, all: null };
  }

  private async assertSelectedVehicles(user: User, requested: string[], groupId?: string): Promise<void> {
    if (!user.organizationId) throw new ForbiddenException('Organization access required');
    if (!Array.isArray(requested) || requested.some(id => typeof id !== 'string')) throw new BadRequestException('Invalid vehicle selection');
    const ids = [...new Set(requested)];
    const rows = ids.length ? await this.vehicles.find({ where: { organizationId: user.organizationId, id: In(ids) }, select: { id: true } }) : [];
    if (rows.length !== ids.length) throw new ForbiddenException('Vehicle selection is outside your organization');
    const scope = await this.accessibleVehicleIds(user);
    let existingGroupIds: string[] = [];
    if (groupId) existingGroupIds = (await this.svc.listGroups(user.organizationId)).find(group => group.id === groupId)?.vehicleIds ?? [];
    if (scope.all !== null && ids.some(id => !scope.all!.includes(id) && !existingGroupIds.includes(id))) {
      throw new ForbiddenException('Vehicle selection is outside your access');
    }
  }

  private resolveOrgId(user: User, orgId?: string): string | null {
    if (INTERNAL_ROLES.has(user.role)) return orgId ?? null;
    if (!user.organizationId) throw new ForbiddenException('Organization access required');
    return user.organizationId ?? null;
  }
}
