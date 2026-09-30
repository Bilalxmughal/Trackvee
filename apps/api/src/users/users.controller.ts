import { BadRequestException, Controller, Delete, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Query, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { In, Repository } from 'typeorm';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from './entities/user.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { OrgPermissionsService, OrgPermDto } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { assertClientFeatureAccess, INTERNAL_ROLES, validateOrgPermissionGrant } from '../org-permissions/client-feature-access.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { VehicleGroup } from '../vehicle-groups/entities/vehicle-group.entity.js';
import { VehicleGroupMembership } from '../vehicle-groups/entities/vehicle-group-membership.entity.js';

function getIp(req: Request): string { return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''; }
const CLIENT_ROLE_LEVEL: Record<string, number> = { client_owner: 4, client_super_admin: 3, client_admin: 2, client_user: 1 };
const PERMISSION_FIELDS = [
  'dashboardView', 'mapView', 'vehiclesView', 'vehiclesAdd', 'vehiclesEdit', 'vehiclesDelete', 'alertsView', 'alertsAdd', 'alertsEdit', 'alertsDelete',
  'geofencesView', 'geofencesAdd', 'geofencesEdit', 'geofencesDelete', 'poisView', 'poisAdd', 'poisEdit', 'poisDelete',
  'driverBehaviorView', 'driverBehaviorEdit', 'reportsView', 'usersView', 'usersAdd', 'usersEdit', 'usersDelete',
  'maintenanceView', 'maintenanceAdd', 'maintenanceEdit', 'maintenanceDelete',
] as const;

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
    private audit: AuditLogsService,
    private orgPermissions: OrgPermissionsService,
    private rolePermissions: RolePortalPermissionsService,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
    @InjectRepository(VehicleGroup) private groups: Repository<VehicleGroup>,
    @InjectRepository(VehicleGroupMembership) private memberships: Repository<VehicleGroupMembership>,
  ) {}

  @Get()
  findAll(@Query('role') role: string | undefined, @Query('cityId') cityId: string | undefined, @CurrentUser() user: User) {
    if (!INTERNAL_ROLES.has(user.role)) throw new ForbiddenException();
    return this.usersService.findAll(role, cityId);
  }

  @Get('org-users')
  async findOrgUsers(@Query('organizationId') requestedOrgId: string | undefined, @CurrentUser() user: User) {
    if (INTERNAL_ROLES.has(user.role)) {
      if (!requestedOrgId) return this.usersService.findOrgUsers();
      return this.usersService.findOrgUsers(requestedOrgId);
    }
    await assertClientFeatureAccess(user, 'users', 'view', this.orgPermissions, this.rolePermissions);
    const organizationId = user.organizationId!;
    if (requestedOrgId && requestedOrgId !== organizationId) throw new ForbiddenException();
    const users = await this.usersService.findOrgUsers(organizationId);
    const level = CLIENT_ROLE_LEVEL[user.role] ?? 0;
    return users.filter(target => target.id === user.id || (CLIENT_ROLE_LEVEL[target.role] ?? 0) < level);
  }

  @Get('vehicle-access-options')
  async vehicleAccessOptions(@CurrentUser() user: User) {
    await assertClientFeatureAccess(user, 'users', 'view', this.orgPermissions, this.rolePermissions);
    const organizationId = user.organizationId!;
    const ownPermission = await this.orgPermissions.findByUser(user.id);
    if (ownPermission && ownPermission.orgId !== organizationId) throw new ForbiddenException();
    const scope = ownPermission?.vehicleIds ?? null;
    const allVehicles = await this.vehicles.find({
      where: { organizationId, ...(scope === null ? {} : { id: In(scope.length ? scope : ['00000000-0000-0000-0000-000000000000']) }) },
      select: { id: true, displayId: true, licensePlate: true, name: true, make: true, model: true },
      order: { displayId: 'ASC' },
    });
    const vehicleIds = new Set(allVehicles.map(vehicle => vehicle.id));
    const groupRows = await this.groups.find({ where: { organizationId }, order: { name: 'ASC' } });
    const memberRows = groupRows.length
      ? await this.memberships.find({ where: { groupId: In(groupRows.map(group => group.id)) } })
      : [];
    const membersByGroup = new Map<string, string[]>();
    for (const member of memberRows) {
      if (!vehicleIds.has(member.vehicleId)) continue;
      const values = membersByGroup.get(member.groupId) ?? [];
      values.push(member.vehicleId);
      membersByGroup.set(member.groupId, values);
    }
    return {
      vehicles: allVehicles,
      groups: groupRows.map(group => ({ id: group.id, name: group.name, vehicleIds: membersByGroup.get(group.id) ?? [] })).filter(group => group.vehicleIds.length > 0),
      allVehiclesAllowed: scope === null,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() caller: User) {
    const target = await this.usersService.findById(id);
    if (!target) throw new NotFoundException('User not found');
    if (INTERNAL_ROLES.has(caller.role)) return target;
    if (!caller.organizationId || caller.organizationId !== target.organizationId) throw new NotFoundException('User not found');
    if (caller.id !== target.id) {
      await assertClientFeatureAccess(caller, 'users', 'view', this.orgPermissions, this.rolePermissions);
      this.assertLowerRole(caller, target.role);
    }
    return target;
  }

  @Post()
  async create(@Body() body: Record<string, unknown>, @CurrentUser() caller: User, @Req() req: Request) {
    let data: Record<string, unknown>;
    let orgPerm: OrgPermDto | null = null;
    if (INTERNAL_ROLES.has(caller.role)) {
      data = this.pickUserFields(body, 'internal');
    } else {
      await assertClientFeatureAccess(caller, 'users', 'add', this.orgPermissions, this.rolePermissions);
      if (!caller.organizationId) throw new ForbiddenException('Organization access required');
      if (body.organizationId && body.organizationId !== caller.organizationId) throw new ForbiddenException();
      const role = typeof body.role === 'string' ? body.role : 'client_user';
      this.assertAssignableRole(caller, role);
      data = this.pickUserFields({ ...body, role, organizationId: caller.organizationId }, 'client-managed');
      if (body.permissions !== undefined) {
        orgPerm = this.pickOrgPermission(body.permissions);
        const target = { id: '', organizationId: caller.organizationId, role } as User;
        await this.validateGrant(caller, target, orgPerm, 'add');
      }
    }
    if (typeof data.email !== 'string' || !data.email.trim() || typeof data.password !== 'string' || data.password.length < 1) {
      throw new BadRequestException('Email and password are required');
    }

    const result = await this.usersService.create(data as Parameters<UsersService['create']>[0]);
    if (orgPerm && caller.organizationId) {
      try { await this.orgPermissions.upsert(result.id, caller.organizationId, orgPerm); }
      catch (error) { await this.usersService.remove(result.id); throw error; }
    }
    this.audit.log({ user: caller, ip: getIp(req) }, { action: 'create', entityType: 'user', entityId: result.id, entityName: `${result.firstName ?? ''} ${result.lastName ?? ''}`.trim() || result.email }).catch(() => {});
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>, @CurrentUser() caller: User, @Req() req: Request) {
    const target = await this.usersService.findById(id);
    if (!target) throw new NotFoundException('User not found');
    const internal = INTERNAL_ROLES.has(caller.role);
    let data: Record<string, unknown>;
    let orgPerm: OrgPermDto | null = null;
    if (internal) {
      data = this.pickUserFields(body, 'internal');
    } else {
      if (!caller.organizationId || caller.organizationId !== target.organizationId) throw new NotFoundException('User not found');
      if (body.organizationId && body.organizationId !== caller.organizationId) throw new ForbiddenException();
      if (caller.id !== target.id) {
        await assertClientFeatureAccess(caller, 'users', 'edit', this.orgPermissions, this.rolePermissions);
        this.assertLowerRole(caller, target.role);
      }
      data = this.pickUserFields(body, caller.id === target.id ? 'client-self' : 'client-managed');
      if (data.role !== undefined) this.assertAssignableRole(caller, String(data.role));
      if (body.permissions !== undefined) {
        if (caller.id === target.id) throw new ForbiddenException('You cannot change your own permissions');
        orgPerm = this.pickOrgPermission(body.permissions);
        const nextTarget = { ...target, role: (data.role as User['role'] | undefined) ?? target.role };
        await this.validateGrant(caller, nextTarget, orgPerm, 'edit');
      }
    }
    const result = await this.usersService.update(id, data as Parameters<UsersService['update']>[1]);
    if (orgPerm && result.organizationId) await this.orgPermissions.upsert(result.id, result.organizationId, orgPerm);
    this.audit.log({ user: caller, ip: getIp(req) }, { action: 'update', entityType: 'user', entityId: id, entityName: typeof body.email === 'string' ? body.email : `${result.firstName ?? ''} ${result.lastName ?? ''}`.trim() }).catch(() => {});
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() caller: User, @Req() req: Request) {
    if (id === caller.id) throw new ForbiddenException('You cannot delete your own account');
    const target = await this.usersService.findById(id);
    if (!target) throw new NotFoundException('User not found');
    if (!INTERNAL_ROLES.has(caller.role)) {
      if (!caller.organizationId || caller.organizationId !== target.organizationId) throw new NotFoundException('User not found');
      await assertClientFeatureAccess(caller, 'users', 'delete', this.orgPermissions, this.rolePermissions);
      this.assertLowerRole(caller, target.role);
    }
    await this.usersService.remove(id);
    this.audit.log({ user: caller, ip: getIp(req) }, { action: 'delete', entityType: 'user', entityId: id }).catch(() => {});
  }

  @Post(':id/revoke')
  async revoke(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    if (user.role !== 'super_admin' && user.role !== 'admin') throw new ForbiddenException();
    await this.usersService.revoke(id);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'user', entityId: id, details: { action: 'revoke' } }).catch(() => {});
    return { ok: true };
  }

  private assertLowerRole(caller: User, targetRole: string): void {
    const targetLevel = CLIENT_ROLE_LEVEL[targetRole] ?? 0;
    if (!targetLevel || targetRole === 'client_owner' || targetLevel >= (CLIENT_ROLE_LEVEL[caller.role] ?? 0)) {
      throw new ForbiddenException('You cannot manage this user');
    }
  }

  private assertAssignableRole(caller: User, role: string): void {
    this.assertLowerRole(caller, role);
  }

  private pickUserFields(body: Record<string, unknown>, mode: 'internal' | 'client-managed' | 'client-self'): Record<string, unknown> {
    const fields = ['email', 'password', 'firstName', 'lastName'];
    if (mode === 'internal') fields.push('role', 'organizationId', 'cityId', 'isActive');
    else if (mode === 'client-managed') fields.push('role', 'organizationId', 'isActive');
    const picked: Record<string, unknown> = {};
    for (const field of fields) if (Object.prototype.hasOwnProperty.call(body, field)) picked[field] = body[field];
    if (typeof picked.email === 'string') picked.email = picked.email.trim().toLowerCase();
    for (const field of ['firstName', 'lastName']) {
      if (picked[field] !== undefined && picked[field] !== null && typeof picked[field] !== 'string') throw new BadRequestException(`Invalid ${field}`);
    }
    if (picked.password !== undefined && (typeof picked.password !== 'string' || picked.password.length < 8)) throw new BadRequestException('Password must contain at least 8 characters');
    if (picked.role !== undefined && typeof picked.role !== 'string') throw new BadRequestException('Invalid role');
    if (picked.isActive !== undefined && typeof picked.isActive !== 'boolean') throw new BadRequestException('Invalid status');
    return picked;
  }

  private pickOrgPermission(value: unknown): OrgPermDto {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Invalid permission settings');
    const input = value as Record<string, unknown>;
    const dto: OrgPermDto = {};
    for (const field of PERMISSION_FIELDS) {
      if (input[field] === undefined) continue;
      if (input[field] === null && ['dashboardView', 'mapView', 'driverBehaviorView', 'driverBehaviorEdit', 'reportsView', 'usersView', 'usersAdd', 'usersEdit', 'usersDelete', 'maintenanceView', 'maintenanceAdd', 'maintenanceEdit', 'maintenanceDelete'].includes(field)) {
        (dto as Record<string, unknown>)[field] = null;
        continue;
      }
      if (typeof input[field] !== 'boolean') throw new BadRequestException(`Invalid permission value: ${field}`);
      (dto as Record<string, unknown>)[field] = input[field];
    }
    if (input.vehicleIds !== undefined) {
      if (input.vehicleIds !== null && (!Array.isArray(input.vehicleIds) || input.vehicleIds.some(id => typeof id !== 'string'))) {
        throw new BadRequestException('Invalid vehicle access');
      }
      dto.vehicleIds = input.vehicleIds as string[] | null;
    }
    return dto;
  }

  private async validateGrant(caller: User, target: User, dto: OrgPermDto, action: 'add' | 'edit'): Promise<void> {
    await validateOrgPermissionGrant(caller, target, dto, action, this.orgPermissions, this.rolePermissions, async ids => {
      if (!ids.length) return [];
      const rows = await this.vehicles.find({ where: { organizationId: caller.organizationId!, id: In(ids) }, select: { id: true } });
      return rows.map(row => row.id);
    });
  }
}
