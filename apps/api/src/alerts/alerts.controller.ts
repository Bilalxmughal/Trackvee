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
  getLogs(@CurrentUser() user: User, @Query('alertId') alertId?: string, @Query('limit') limit?: string) {
    return this.svc.getLogs(user, alertId, limit ? +limit : 100);
  }

  @Get('logs/:id')
  getLogDetail(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.getLogDetail(user, id);
  }

  @Post('push-token')
  registerPushToken(@CurrentUser() user: User, @Body() body: { token?: unknown; platform?: unknown; supportsCustomSounds?: unknown }) {
    return this.svc.registerPushToken(user, body?.token, body?.platform, body?.supportsCustomSounds);
  }

  @Delete('push-token')
  removePushToken(@CurrentUser() user: User, @Body() body: { token?: unknown }) {
    return this.svc.removePushToken(user, body?.token);
  }

  @Get('vehicle/:imei')
  findForVehicle(@CurrentUser() user: User, @Param('imei') imei: string) {
    return this.svc.findForVehicle(user, imei);
  }

  @Post()
  async create(@CurrentUser() user: User, @Query('orgId') orgId: string | undefined, @Body() dto: Partial<Alert>, @Req() req: Request) {
    const result = await this.svc.create(user, dto, orgId);
    this.audit.log({ user, ip: getIp(req) }, { action: 'create', entityType: 'alert', entityId: result.id, entityName: result.name }).catch(() => {});
    return result;
  }

  @Post('vehicle/:imei')
  createForVehicle(@CurrentUser() user: User, @Param('imei') imei: string, @Body() dto: Partial<Alert>) {
    return this.svc.createForVehicle(user, imei, dto);
  }

  @Put(':id/vehicle/:imei')
  updateForVehicle(@CurrentUser() user: User, @Param('id') id: string, @Param('imei') imei: string, @Body() dto: Partial<Alert>) {
    return this.svc.updateForVehicle(user, id, imei, dto);
  }

  @Delete(':id/vehicle/:imei')
  removeForVehicle(@CurrentUser() user: User, @Param('id') id: string, @Param('imei') imei: string) {
    return this.svc.removeForVehicle(user, id, imei);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: Partial<Alert>, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.svc.update(id, dto, user);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'alert', entityId: id, entityName: (dto as any).name ?? result.name }).catch(() => {});
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.svc.remove(id, user);
    this.audit.log({ user, ip: getIp(req) }, { action: 'delete', entityType: 'alert', entityId: id }).catch(() => {});
  }
}
