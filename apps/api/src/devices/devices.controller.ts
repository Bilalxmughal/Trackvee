import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Headers, UnauthorizedException, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('devices')
@Controller('devices')
export class DevicesController {
  constructor(private devicesService: DevicesService) {}

  // Called by gateway on LOGIN and HEARTBEAT — marks device active, persists heartbeat status
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
  create(@Body() body: Partial<any>) {
    return this.devicesService.create(body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<any>) {
    return this.devicesService.update(id, body);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.devicesService.remove(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post(':imei/command')
  @HttpCode(200)
  sendCommand(
    @Param('imei') imei: string,
    @Body() body: { action: 'immobilize' | 'activate' },
  ) {
    return this.devicesService.sendCommandByImei(imei, body.action);
  }
}
