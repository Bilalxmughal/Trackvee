import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { OrganizationsService } from './organizations.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';

function getIp(req: Request): string { return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''; }

@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private orgService: OrganizationsService, private audit: AuditLogsService) {}

  @Get()
  findAll(@Query('cityId') cityId?: string, @Query('type') type?: string) {
    return this.orgService.findAll(cityId, type);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.orgService.findOne(id);
  }

  @Post()
  async create(@Body() body: Partial<any>, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.orgService.create(body, user.id);
    this.audit.log({ user, ip: getIp(req) }, { action: 'create', entityType: 'organization', entityId: result.id, entityName: result.name }).catch(() => {});
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Partial<any>, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.orgService.update(id, body);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'organization', entityId: id, entityName: body.name ?? result.name }).catch(() => {});
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.orgService.remove(id);
    this.audit.log({ user, ip: getIp(req) }, { action: 'delete', entityType: 'organization', entityId: id }).catch(() => {});
  }
}
