import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VehicleGroupsService } from './vehicle-groups.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@ApiTags('vehicle-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicle-groups')
export class VehicleGroupsController {
  constructor(private svc: VehicleGroupsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query('orgId') orgId?: string) {
    const resolvedOrgId = this.resolveOrgId(user, orgId);
    if (!resolvedOrgId) return [];
    return this.svc.listGroups(resolvedOrgId);
  }

  @Post()
  create(
    @CurrentUser() user: User,
    @Query('orgId') orgId: string | undefined,
    @Body() body: { name: string; vehicleIds: string[] },
  ) {
    const resolvedOrgId = this.resolveOrgId(user, orgId);
    if (!resolvedOrgId) return null;
    return this.svc.createGroup(resolvedOrgId, body.name, body.vehicleIds ?? []);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('orgId') orgId: string | undefined,
    @Body() body: { name: string; vehicleIds: string[] },
  ) {
    const resolvedOrgId = this.resolveOrgId(user, orgId);
    if (!resolvedOrgId) return null;
    return this.svc.updateGroup(id, resolvedOrgId, body.name, body.vehicleIds ?? []);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Query('orgId') orgId: string | undefined,
  ) {
    const resolvedOrgId = this.resolveOrgId(user, orgId);
    if (!resolvedOrgId) return null;
    return this.svc.deleteGroup(id, resolvedOrgId);
  }

  private resolveOrgId(user: User, orgId?: string): string | null {
    if (ADMIN_ROLES.includes(user.role)) return orgId ?? null;
    return user.organizationId ?? null;
  }
}
