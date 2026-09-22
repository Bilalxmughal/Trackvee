import { Controller, Get, Put, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DriverBehaviorService } from './driver-behavior.service.js';
import { DriverBehaviorSettings } from './entities/driver-behavior-settings.entity.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@ApiTags('driver-behavior')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('driver-behavior')
export class DriverBehaviorController {
  constructor(private svc: DriverBehaviorService) {}

  @Get('settings')
  getSettings(@CurrentUser() user: User, @Query('orgId') orgId?: string) {
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : (user.organizationId ?? null);
    if (!resolvedOrgId) return null;
    return this.svc.getSettings(resolvedOrgId);
  }

  @Put('settings')
  updateSettings(@CurrentUser() user: User, @Query('orgId') orgId: string | undefined, @Body() dto: Partial<DriverBehaviorSettings>) {
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : (user.organizationId ?? null);
    if (!resolvedOrgId) return null;
    return this.svc.updateSettings(resolvedOrgId, dto);
  }

  @Get('leaderboard')
  getLeaderboard(@CurrentUser() user: User, @Query('orgId') orgId?: string) {
    if (ADMIN_ROLES.includes(user.role)) {
      return this.svc.getLeaderboard(orgId ?? null);
    }
    if (!user.organizationId) return [];
    return this.svc.getLeaderboard(user.organizationId);
  }

  @Delete('scores/:id')
  @HttpCode(204)
  deleteScore(@Param('id') id: string) {
    return this.svc.deleteScore(id);
  }

  // ── Group settings ────────────────────────────────────────────────────────

  @Get('settings/group/:groupId')
  getGroupSettings(@Param('groupId') groupId: string) {
    return this.svc.getGroupSettings(groupId);
  }

  @Put('settings/group/:groupId')
  setGroupSettings(
    @CurrentUser() user: User,
    @Param('groupId') groupId: string,
    @Query('orgId') orgId: string | undefined,
    @Body() dto: Partial<import('./entities/driver-behavior-settings.entity.js').DriverBehaviorSettings>,
  ) {
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : (user.organizationId ?? null);
    if (!resolvedOrgId) return null;
    return this.svc.setGroupSettings(groupId, resolvedOrgId, dto);
  }

  @Delete('settings/group/:groupId')
  clearGroupSettings(@Param('groupId') groupId: string) {
    return this.svc.clearGroupSettings(groupId);
  }

  // ── Vehicle settings ──────────────────────────────────────────────────────

  @Get('settings/vehicle/:vehicleId')
  getVehicleSettings(@Param('vehicleId') vehicleId: string) {
    return this.svc.getVehicleSettings(vehicleId);
  }

  @Put('settings/vehicle/:vehicleId')
  setVehicleSettings(
    @CurrentUser() user: User,
    @Param('vehicleId') vehicleId: string,
    @Query('orgId') orgId: string | undefined,
    @Body() dto: Partial<import('./entities/driver-behavior-settings.entity.js').DriverBehaviorSettings>,
  ) {
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : (user.organizationId ?? null);
    if (!resolvedOrgId) return null;
    return this.svc.setVehicleSettings(vehicleId, resolvedOrgId, dto);
  }

  @Delete('settings/vehicle/:vehicleId')
  clearVehicleSettings(@Param('vehicleId') vehicleId: string) {
    return this.svc.clearVehicleSettings(vehicleId);
  }

  // ── Score history / events ────────────────────────────────────────────────

  @Get('vehicle/:vehicleId/scores')
  getVehicleScores(
    @Param('vehicleId') vehicleId: string,
    @Query('days') days?: string,
  ) {
    return this.svc.getVehicleScoreHistory(vehicleId, days ? +days : 30);
  }

  @Get('vehicle/:vehicleId/events')
  getVehicleEvents(
    @Param('vehicleId') vehicleId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getVehicleEvents(vehicleId, from, to);
  }

  private resolveOrgId(user: User): string | null {
    if (ADMIN_ROLES.includes(user.role)) return null;
    return user.organizationId ?? null;
  }
}
