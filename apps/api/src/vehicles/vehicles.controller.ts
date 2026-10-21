import { createHmac, timingSafeEqual } from 'node:crypto';
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, Req, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { VehiclesService } from './vehicles.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { Vehicle } from './entities/vehicle.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';
import { DevicesService } from '../devices/devices.service.js';

function getIp(req: Request): string { return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''; }

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService, private devicesService: DevicesService, private audit: AuditLogsService) {}

  @Get()
  findAll(@CurrentUser() user: User, @Query('cityId') cityId?: string) {
    return this.vehiclesService.findForUser(user, cityId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.vehiclesService.findOne(id, user);
  }

  @Post()
  async create(@Body() body: Partial<Vehicle>, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.vehiclesService.create(body, user);
    this.audit.log({ user, ip: getIp(req) }, { action: 'create', entityType: 'vehicle', entityId: result.id, entityName: (result as any).plateNumber ?? (result as any).name }).catch(() => {});
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Partial<Vehicle>, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.vehiclesService.update(id, body, user);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'vehicle', entityId: id, entityName: (body as any).plateNumber ?? (body as any).name }).catch(() => {});
    return result;
  }

  @Patch(':id/lifecycle')
  async updateLifecycle(
    @Param('id') id: string,
    @Body() body: { lifecycleStatus: 'active' | 'expired' | 'archived'; expiresAt?: string | null },
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const result = await this.vehiclesService.updateLifecycle(id, body.lifecycleStatus, body.expiresAt, user);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'vehicle', entityId: id, entityName: result.licensePlate ?? result.name, details: { lifecycleStatus: result.lifecycleStatus, expiresAt: result.expiresAt } }).catch(() => {});
    return result;
  }

  @Post(':id/device-assignment')
  async updateDeviceAssignment(
    @Param('id') id: string,
    @Body() body: { deviceId: string | null; reason?: string; odometerKm?: number | null; notes?: string },
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const result = await this.devicesService.updateVehicleDevice(user, id, body);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'vehicle', entityId: id, details: { action: body.deviceId ? 'device_assigned_or_replaced' : 'device_removed', deviceId: body.deviceId, reason: body.reason ?? null } }).catch(() => {});
    return result;
  }

  @Patch(':id/odometer')
  async setOdometer(
    @Param('id') id: string,
    @Body() body: { odometerKm: number },
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const result = await this.vehiclesService.setOdometer(id, body.odometerKm, user);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'vehicle', entityId: id, details: { odometerKm: body.odometerKm } }).catch(() => {});
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.vehiclesService.remove(id, user);
    this.audit.log({ user, ip: getIp(req) }, { action: 'delete', entityType: 'vehicle', entityId: id }).catch(() => {});
    return result;
  }

  @Post(':id/live-share')
  @HttpCode(200)
  async createLiveShare(@Param('id') id: string, @CurrentUser() user: User) {
    const vehicle = await this.vehiclesService.findOne(id, user);
    const secret = process.env['SHARE_SECRET'] ?? process.env['JWT_SECRET'] ?? 'change-me';
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const payload = Buffer.from(JSON.stringify({ vehicleId: vehicle.id, expiresAt })).toString('base64url');
    const sig = createHmac('sha256', secret).update(payload).digest('hex');
    const token = `${payload}.${sig}`;
    const baseUrl = process.env['WEB_SHARE_URL'] ?? 'https://admin.trackvee.com';
    return { url: `${baseUrl}/live/${token}` };
  }

  @Post(':id/command')
  @HttpCode(200)
  async sendCommand(
    @Param('id') id: string,
    @Body() body: { action: 'immobilize' | 'activate' },
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const result = await this.vehiclesService.sendCommand(id, body.action, user);
    this.audit.log({ user, ip: getIp(req) }, { action: 'command', entityType: 'vehicle', entityId: id, details: { command: body.action } }).catch(() => {});
    return result;
  }
}
