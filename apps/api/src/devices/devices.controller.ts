import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Headers, UnauthorizedException, HttpCode, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { DevicesService } from './devices.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';

function getIp(req: Request): string { return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''; }

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(private devicesService: DevicesService, private audit: AuditLogsService) {}

  @Post('checkin')
  async checkin(
    @Headers('x-internal-key') key: string,
    @Body() body: {
      imei: string;
      ignition?: boolean; externalPower?: boolean; immobilizer?: boolean;
      voltageLevel?: number; gsmSignal?: number;
    },
  ) {
    const expected = process.env.INTERNAL_API_KEY;
    if (!expected || key !== expected) throw new UnauthorizedException('Invalid internal key');
    if (body.ignition !== undefined) {
      await this.devicesService.saveHeartbeat(body.imei, {
        ignition: body.ignition,
        externalPower: body.externalPower ?? false,
        immobilizer: body.immobilizer ?? false,
        voltageLevel: body.voltageLevel ?? 0,
        gsmSignal: body.gsmSignal ?? 0,
      }).catch(() => {});
    } else {
      await this.devicesService.updateLastSeen(body.imei).catch(() => {});
    }
    return { ok: true };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@CurrentUser() user: User, @Query('cityId') cityId?: string) {
    return this.devicesService.findAll(user, cityId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.devicesService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() body: Partial<any>, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.devicesService.create(body);
    this.audit.log({ user, ip: getIp(req) }, { action: 'create', entityType: 'device', entityId: result.id, entityName: (result as any).imei ?? (result as any).name }).catch(() => {});
    return result;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Partial<any>, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.devicesService.update(id, body);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'device', entityId: id, entityName: (body as any).imei }).catch(() => {});
    return result;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.devicesService.remove(id);
    this.audit.log({ user, ip: getIp(req) }, { action: 'delete', entityType: 'device', entityId: id }).catch(() => {});
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':imei/command')
  @HttpCode(200)
  async sendCommand(
    @Param('imei') imei: string,
    @Body() body: { action: 'immobilize' | 'activate' },
    @CurrentUser() user: User,
    @Req() req: Request,
  ) {
    const result = await this.devicesService.sendCommandByImei(user, imei, body.action);
    this.audit.log({ user, ip: getIp(req) }, { action: 'command', entityType: 'device', entityId: imei, details: { command: body.action } }).catch(() => {});
    return result;
  }
}
