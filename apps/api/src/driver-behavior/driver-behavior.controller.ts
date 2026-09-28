import { BadRequestException, Controller, Delete, ForbiddenException, Get, HttpCode, NotFoundException, Param, Put, Query, Body, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DriverBehaviorService } from './driver-behavior.service.js';
import { DriverBehaviorSettings } from './entities/driver-behavior-settings.entity.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { VehicleGroup } from '../vehicle-groups/entities/vehicle-group.entity.js';
import { VehicleGroupMembership } from '../vehicle-groups/entities/vehicle-group-membership.entity.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];
const CLIENT_DEFAULTS: Record<string, string[]> = {
  client_owner: ['view', 'edit'],
  client_super_admin: ['view', 'edit'],
  client_admin: ['view'],
  client_user: ['view'],
};
const SETTINGS_FIELDS = [
  'overspeedThreshold', 'harshBrakeDeceleration', 'rapidAccelThreshold', 'sharpTurnAngle', 'sharpTurnMinSpeed',
  'deductionHarshBrake', 'deductionRapidAccel', 'deductionSharpTurn', 'deductionOverspeed',
] as const satisfies readonly (keyof DriverBehaviorSettings)[];
const SETTING_MAX: Record<(typeof SETTINGS_FIELDS)[number], number> = {
  overspeedThreshold: 1000, harshBrakeDeceleration: 1000, rapidAccelThreshold: 1000,
  sharpTurnAngle: 360, sharpTurnMinSpeed: 1000,
  deductionHarshBrake: 100, deductionRapidAccel: 100, deductionSharpTurn: 100, deductionOverspeed: 100,
};

@ApiTags('driver-behavior')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('driver-behavior')
export class DriverBehaviorController {
  constructor(
    private svc: DriverBehaviorService,
    private rolePermissions: RolePortalPermissionsService,
    private orgPermissions: OrgPermissionsService,
    @InjectRepository(Vehicle) private vehicles: Repository<Vehicle>,
    @InjectRepository(VehicleGroup) private groups: Repository<VehicleGroup>,
    @InjectRepository(VehicleGroupMembership) private memberships: Repository<VehicleGroupMembership>,
  ) {}

  @Get('settings')
  async getSettings(@CurrentUser() user: User, @Query('orgId') orgId?: string) {
    await this.assertPermission(user, 'view');
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : user.organizationId;
    return resolvedOrgId ? this.svc.getSettings(resolvedOrgId) : null;
  }

  @Put('settings')
  async updateSettings(@CurrentUser() user: User, @Query('orgId') orgId: string | undefined, @Body() dto: Partial<DriverBehaviorSettings>) {
    await this.assertPermission(user, 'edit');
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : user.organizationId;
    return resolvedOrgId ? this.svc.updateSettings(resolvedOrgId, this.settingsPayload(dto)) : null;
  }

  @Get('leaderboard')
  async getLeaderboard(@CurrentUser() user: User, @Query('orgId') orgId?: string) {
    await this.assertPermission(user, 'view');
    if (ADMIN_ROLES.includes(user.role)) return this.svc.getLeaderboard(orgId ?? null);
    if (!user.organizationId) return [];
    const vehicleIds = await this.permittedVehicleIds(user);
    return this.svc.getLeaderboard(user.organizationId, vehicleIds);
  }

  @Delete('scores/:id')
  @HttpCode(204)
  deleteScore(@Param('id') id: string, @CurrentUser() user: User) {
    if (!ADMIN_ROLES.includes(user.role)) throw new ForbiddenException();
    return this.svc.deleteScore(id);
  }

  @Get('settings/group/:groupId')
  async getGroupSettings(@Param('groupId') groupId: string, @CurrentUser() user: User) {
    await this.assertPermission(user, 'view');
    if (!ADMIN_ROLES.includes(user.role)) await this.assertGroupInOrg(groupId, user, 'view');
    return this.svc.getGroupSettings(groupId, ADMIN_ROLES.includes(user.role) ? undefined : user.organizationId!);
  }

  @Put('settings/group/:groupId')
  async setGroupSettings(
    @CurrentUser() user: User,
    @Param('groupId') groupId: string,
    @Query('orgId') orgId: string | undefined,
    @Body() dto: Partial<DriverBehaviorSettings>,
  ) {
    await this.assertPermission(user, 'edit');
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : user.organizationId;
    if (!resolvedOrgId) return null;
    if (!ADMIN_ROLES.includes(user.role)) await this.assertGroupInOrg(groupId, user, 'edit');
    return this.svc.setGroupSettings(groupId, resolvedOrgId, this.settingsPayload(dto));
  }

  @Delete('settings/group/:groupId')
  async clearGroupSettings(@Param('groupId') groupId: string, @CurrentUser() user: User) {
    await this.assertPermission(user, 'edit');
    if (!ADMIN_ROLES.includes(user.role)) await this.assertGroupInOrg(groupId, user, 'edit');
    return this.svc.clearGroupSettings(groupId, ADMIN_ROLES.includes(user.role) ? undefined : user.organizationId!);
  }

  @Get('settings/vehicle/:vehicleId')
  async getVehicleSettings(@Param('vehicleId') vehicleId: string, @CurrentUser() user: User) {
    await this.assertPermission(user, 'view');
    if (!ADMIN_ROLES.includes(user.role)) await this.assertVehicleInOrg(vehicleId, user);
    return this.svc.getVehicleSettings(vehicleId, ADMIN_ROLES.includes(user.role) ? undefined : user.organizationId!);
  }

  @Put('settings/vehicle/:vehicleId')
  async setVehicleSettings(
    @CurrentUser() user: User,
    @Param('vehicleId') vehicleId: string,
    @Query('orgId') orgId: string | undefined,
    @Body() dto: Partial<DriverBehaviorSettings>,
  ) {
    await this.assertPermission(user, 'edit');
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : user.organizationId;
    if (!resolvedOrgId) return null;
    if (!ADMIN_ROLES.includes(user.role)) await this.assertVehicleInOrg(vehicleId, user);
    return this.svc.setVehicleSettings(vehicleId, resolvedOrgId, this.settingsPayload(dto));
  }

  @Delete('settings/vehicle/:vehicleId')
  async clearVehicleSettings(@Param('vehicleId') vehicleId: string, @CurrentUser() user: User) {
    await this.assertPermission(user, 'edit');
    if (!ADMIN_ROLES.includes(user.role)) await this.assertVehicleInOrg(vehicleId, user);
    return this.svc.clearVehicleSettings(vehicleId, ADMIN_ROLES.includes(user.role) ? undefined : user.organizationId!);
  }

  @Get('vehicle/:vehicleId/scores')
  async getVehicleScores(@Param('vehicleId') vehicleId: string, @Query('days') days: string | undefined, @CurrentUser() user: User) {
    await this.assertPermission(user, 'view');
    if (!ADMIN_ROLES.includes(user.role)) await this.assertVehicleInOrg(vehicleId, user);
    const boundedDays = Math.max(1, Math.min(365, Number(days) || 30));
    return this.svc.getVehicleScoreHistory(vehicleId, boundedDays, ADMIN_ROLES.includes(user.role) ? undefined : user.organizationId!);
  }

  @Get('vehicle/:vehicleId/events')
  async getVehicleEvents(
    @Param('vehicleId') vehicleId: string,
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: User,
  ) {
    await this.assertPermission(user, 'view');
    if (!ADMIN_ROLES.includes(user.role)) await this.assertVehicleInOrg(vehicleId, user);
    return this.svc.getVehicleEvents(vehicleId, from, to, ADMIN_ROLES.includes(user.role) ? undefined : user.organizationId!);
  }

  private async assertPermission(user: User, action: 'view' | 'edit'): Promise<void> {
    if (ADMIN_ROLES.includes(user.role)) return;
    if (!user.organizationId) throw new ForbiddenException('Organization access required');
    const roleMap = await this.rolePermissions.findAll();
    const actions = roleMap[user.role]?.['driver-behavior'] ?? CLIENT_DEFAULTS[user.role] ?? [];
    if (!actions.includes(action)) throw new ForbiddenException(`Driver Behavior ${action} permission required`);
  }

  private async assertVehicleInOrg(vehicleId: string, user: User): Promise<void> {
    if (!user || !user.organizationId) throw new ForbiddenException('Organization access required');
    const vehicle = await this.vehicles.findOne({ where: { id: vehicleId, organizationId: user.organizationId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const allowedIds = await this.permittedVehicleIds(user);
    if (allowedIds && !allowedIds.includes(vehicleId)) throw new NotFoundException('Vehicle not found');
  }

  private async assertGroupInOrg(groupId: string, user: User, action: 'view' | 'edit'): Promise<void> {
    if (!user.organizationId) throw new ForbiddenException('Organization access required');
    const group = await this.groups.findOne({ where: { id: groupId, organizationId: user.organizationId } });
    if (!group) throw new NotFoundException('Vehicle group not found');
    const allowedIds = await this.permittedVehicleIds(user);
    if (!allowedIds) return;
    const members = await this.memberships.find({ where: { groupId } });
    const memberIds = members.map(member => member.vehicleId);
    const visible = memberIds.filter(id => allowedIds.includes(id));
    if (action === 'view' ? visible.length === 0 : visible.length !== memberIds.length || memberIds.length === 0) {
      throw new NotFoundException('Vehicle group not found');
    }
  }

  private async permittedVehicleIds(user: User): Promise<string[] | null> {
    const permission = await this.orgPermissions.findByUser(user.id);
    if (permission && permission.orgId !== user.organizationId) throw new ForbiddenException();
    return permission?.vehicleIds ?? null;
  }

  private settingsPayload(dto: Partial<DriverBehaviorSettings>): Partial<DriverBehaviorSettings> {
    if (!dto || typeof dto !== 'object' || Array.isArray(dto)) throw new BadRequestException('Invalid settings payload');
    const payload: Partial<DriverBehaviorSettings> = {};
    for (const field of SETTINGS_FIELDS) {
      const value = dto[field];
      if (value === undefined) continue;
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > SETTING_MAX[field]) {
        throw new BadRequestException(`Invalid value for ${field}`);
      }
      payload[field] = value;
    }
    if (!Object.keys(payload).length) throw new BadRequestException('No settings fields provided');
    return payload;
  }
}
