import { Body, Controller, ForbiddenException, Get, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrgPermissionsService, OrgPermDto } from './org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@UseGuards(JwtAuthGuard)
@Controller('org-permissions')
export class OrgPermissionsController {
  constructor(
    private svc: OrgPermissionsService,
    private rolePerms: RolePortalPermissionsService,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  private async targetFor(userId: string): Promise<User> {
    const target = await this.users.findOne({ where: { id: userId } });
    if (!target) throw new NotFoundException('User not found');
    return target;
  }

  private canRead(caller: User, target: User): boolean {
    if (['super_admin', 'admin', 'ops'].includes(caller.role)) return true;
    if (!caller.organizationId || caller.organizationId !== target.organizationId) return false;
    if (caller.id === target.id || ['client_owner', 'client_super_admin'].includes(caller.role)) return true;
    return caller.role === 'client_admin' && ['client_admin', 'client_user'].includes(target.role);
  }

  @Get(':userId')
  async findOne(@CurrentUser() caller: User, @Param('userId') userId: string) {
    const target = await this.targetFor(userId);
    if (!this.canRead(caller, target)) throw new ForbiddenException();
    return this.svc.findByUser(target.id);
  }

  @Put(':userId')
  async upsert(@CurrentUser() caller: User, @Param('userId') userId: string, @Body() dto: OrgPermDto & { orgId?: string }) {
    const target = await this.targetFor(userId);
    if (!target.organizationId) throw new ForbiddenException();
    if (!['super_admin', 'admin', 'ops'].includes(caller.role)) {
      if (!caller.organizationId || caller.organizationId !== target.organizationId || caller.id === target.id) throw new ForbiddenException();
      if (!['client_owner', 'client_super_admin', 'client_admin'].includes(caller.role)) throw new ForbiddenException();
      if (['client_owner', 'client_super_admin'].includes(target.role)) throw new ForbiddenException();
      const rows = await this.rolePerms.findAll();
      const actions = rows[caller.role]?.['users'];
      if (actions && !actions.includes('edit')) throw new ForbiddenException('User permission edit not allowed');
    }
    const allowed = ['vehiclesView', 'vehiclesAdd', 'vehiclesEdit', 'vehiclesDelete', 'alertsView', 'alertsAdd', 'alertsEdit', 'alertsDelete', 'geofencesView', 'geofencesAdd', 'geofencesEdit', 'geofencesDelete', 'poisView', 'poisAdd', 'poisEdit', 'poisDelete'] as const;
    const perms: OrgPermDto = {};
    for (const key of allowed) if (typeof dto[key] === 'boolean') perms[key] = dto[key];
    if (dto.vehicleIds === null || (Array.isArray(dto.vehicleIds) && dto.vehicleIds.every(value => typeof value === 'string'))) perms.vehicleIds = dto.vehicleIds;
    return this.svc.upsert(target.id, target.organizationId, perms);
  }
}
