import { Controller, Get, Put, Body, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { RolePortalPermissionsService } from './role-portal-permissions.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('role-portal-permissions')
export class RolePortalPermissionsController {
  constructor(private svc: RolePortalPermissionsService) {}

  @Get()
  findAll() {
    return this.svc.findAll();
  }

  @Put()
  update(@Req() req: any, @Body() body: Record<string, Record<string, string[]>>) {
    if (req.user.role !== 'super_admin') throw new ForbiddenException();
    return this.svc.updateAll(body);
  }
}
