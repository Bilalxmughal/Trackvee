import { Controller, Get, Put, Param, Body, UseGuards, Req } from '@nestjs/common';
import { OrgPermissionsService, OrgPermDto } from './org-permissions.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@UseGuards(JwtAuthGuard)
@Controller('org-permissions')
export class OrgPermissionsController {
  constructor(private svc: OrgPermissionsService) {}

  @Get(':userId')
  findOne(@Param('userId') userId: string) {
    return this.svc.findByUser(userId);
  }

  @Put(':userId')
  upsert(@Param('userId') userId: string, @Body() dto: OrgPermDto & { orgId: string }) {
    const { orgId, ...rest } = dto;
    return this.svc.upsert(userId, orgId, rest);
  }
}
