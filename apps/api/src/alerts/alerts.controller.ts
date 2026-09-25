import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AlertsService } from './alerts.service.js';
import { Alert } from './entities/alert.entity.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';

function getIp(req: Request): string { return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''; }

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private svc: AlertsService, private audit: AuditLogsService) {}

  @Get()
  findAll(@CurrentUser() user: User, @Query('orgId') orgId?: string) { return this.svc.findAll(user, orgId); }

  @Get('logs')
  getLogs(@Query('alertId') alertId?: string, @Query('limit') limit?: string) {
    return this.svc.getLogs(alertId, limit ? +limit : 100);
  }

  @Post()
  async create(@CurrentUser() user: User, @Query('orgId') orgId: string | undefined, @Body() dto: Partial<Alert>, @Req() req: Request) {
    const result = await this.svc.create(user, dto, orgId);
    this.audit.log({ user, ip: getIp(req) }, { action: 'create', entityType: 'alert', entityId: result.id, entityName: result.name }).catch(() => {});
    return result;
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<Alert>, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.svc.update(id, dto);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'alert', entityId: id, entityName: (dto as any).name ?? result.name }).catch(() => {});
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.svc.remove(id);
    this.audit.log({ user, ip: getIp(req) }, { action: 'delete', entityType: 'alert', entityId: id }).catch(() => {});
  }
}
