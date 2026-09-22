import { Controller, Get, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
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
  updateSettings(@CurrentUser() user: User, @Query('orgId') orgId?: string, @Body() dto: Partial<DriverBehaviorSettings>) {
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : (user.organizationId ?? null);
    if (!resolvedOrgId) return null;
    return this.svc.updateSettings(resolvedOrgId, dto);
  }

  @Get('leaderboard')
  getLeaderboard(@CurrentUser() user: User, @Query('orgId') orgId?: string) {
    const resolvedOrgId = ADMIN_ROLES.includes(user.role) ? (orgId ?? null) : user.organizationId;
    if (!resolvedOrgId) return [];
    return this.svc.getLeaderboard(resolvedOrgId);
  }

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
