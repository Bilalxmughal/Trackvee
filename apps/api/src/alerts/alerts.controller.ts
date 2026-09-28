import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AlertsService } from './alerts.service.js';
import { NotificationSoundsService } from './notification-sounds.service.js';
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
  constructor(private svc: AlertsService, private sounds: NotificationSoundsService, private audit: AuditLogsService) {}

  @Get('sounds')
  listSounds(@CurrentUser() user: User, @Query('includeInactive') includeInactive?: string) {
    return this.sounds.list(user, includeInactive === 'true');
  }

  @Get('sounds/:id/audio')
  async getSoundAudio(@CurrentUser() user: User, @Param('id') id: string, @Res() response: Response) {
    const result = await this.sounds.getAudio(user, id);
    response.setHeader('Content-Type', result.metadata.mimeType);
    response.setHeader('Content-Length', result.data.length);
    response.setHeader('Cache-Control', 'private, max-age=300');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', `inline; filename="${result.metadata.fileName}"`);
    response.send(result.data);
  }

  @Post('sounds')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 900 * 1024 } }))
  async createSound(
    @CurrentUser() user: User,
    @Body('name') name: unknown,
    @UploadedFile() file: { buffer?: Buffer; size?: number } | undefined,
    @Req() req: Request,
  ) {
    const sound = await this.sounds.create(user, name, file);
    this.audit.log({ user, ip: getIp(req) }, { action: 'create', entityType: 'notification_sound', entityId: sound.id, entityName: sound.name }).catch(() => {});
    return sound;
  }

  @Patch('sounds/:id')
  async setSoundActive(@CurrentUser() user: User, @Param('id') id: string, @Body('isActive') isActive: unknown, @Req() req: Request) {
    const sound = await this.sounds.setActive(user, id, isActive);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'notification_sound', entityId: id, entityName: sound.name }).catch(() => {});
    return sound;
  }

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
  registerPushToken(@CurrentUser() user: User, @Body() body: { token?: unknown; platform?: unknown; supportsCustomSounds?: unknown; supportsDynamicSounds?: unknown; dynamicSoundIds?: unknown }) {
    return this.svc.registerPushToken(user, body?.token, body?.platform, body?.supportsCustomSounds, body?.supportsDynamicSounds, body?.dynamicSoundIds);
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
