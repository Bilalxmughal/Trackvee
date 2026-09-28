import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PoisService } from './poi.service.js';
import { Poi } from './entities/poi.entity.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';

function getIp(req: Request): string { return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''; }

@ApiTags('pois')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pois')
export class PoisController {
  constructor(private svc: PoisService, private audit: AuditLogsService) {}

  @Get()
  findAll(@CurrentUser() user: User, @Query('orgId') orgId?: string) { return this.svc.findAll(user, orgId); }

  @Post()
  async create(@CurrentUser() user: User, @Query('orgId') orgId: string | undefined, @Body() dto: Partial<Poi>, @Req() req: Request) {
    const result = await this.svc.create(user, dto, orgId);
    this.audit.log({ user, ip: getIp(req) }, { action: 'create', entityType: 'poi', entityId: result.id, entityName: result.name }).catch(() => {});
    return result;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<Poi>, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.svc.update(id, dto, user);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'poi', entityId: id, entityName: (dto as any).name ?? result.name }).catch(() => {});
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.svc.remove(id, user);
    this.audit.log({ user, ip: getIp(req) }, { action: 'delete', entityType: 'poi', entityId: id }).catch(() => {});
  }
}
