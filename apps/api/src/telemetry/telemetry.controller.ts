import { Controller, Get, Post, Param, Query, Body, UseGuards, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service.js';
import { DevicesService } from '../devices/devices.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('telemetry')
@Controller('telemetry')
export class TelemetryController {
  constructor(
    private telemetryService: TelemetryService,
    private devicesService: DevicesService,
  ) {}

  // Internal endpoint called by TCP gateway — protected by shared API key
  @Post('ingest')
  async ingest(
    @Headers('x-internal-key') key: string,
    @Body() body: {
      imei: string;
      timestamp: string;
      latitude: number;
      longitude: number;
      speedKmh: number;
      heading: number;
      gpsValid: boolean;
      satellites: number;
      altitude?: number | null;
      ignition?: boolean | null;
      externalPower?: boolean | null;
      immobilizer?: boolean | null;
      voltageLevel?: number | null;
      gsmSignal?: number | null;
      raw?: object;
    },
  ) {
    const expected = process.env.INTERNAL_API_KEY;
    if (!expected || key !== expected) throw new UnauthorizedException('Invalid internal key');

    const device = await this.devicesService.findByImei(body.imei);
    await this.devicesService.updateLastSeen(body.imei).catch(() => {});

    // If gateway didn't send heartbeat fields, fall back to device's last known heartbeat
    let ignition   = body.ignition   ?? null;
    let extPower   = body.externalPower ?? null;
    let immob      = body.immobilizer ?? null;
    let voltLevel  = body.voltageLevel ?? null;
    let gsmSig     = body.gsmSignal ?? null;

    if (ignition == null && device) {
      const hb = await this.devicesService.getLastHeartbeat(body.imei).catch(() => null);
      if (hb) {
        ignition  = hb.ignition;
        extPower  = hb.externalPower;
        immob     = hb.immobilizer;
        voltLevel = hb.voltageLevel;
        gsmSig    = hb.gsmSignal;
      }
    }

    return this.telemetryService.save({
      imei: body.imei,
      deviceId: device?.id ?? null,
      timestamp: new Date(body.timestamp),
      latitude: body.latitude,
      longitude: body.longitude,
      speedKmh: body.speedKmh,
      heading: body.heading,
      gpsValid: body.gpsValid,
      satellites: body.satellites ?? 0,
      altitude: body.altitude ?? null,
      ignition,
      externalPower: extPower,
      immobilizer: immob,
      voltageLevel: voltLevel,
      gsmSignal: gsmSig,
      raw: body.raw ?? null,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('live')
  getLive(@CurrentUser() user: User) {
    return this.telemetryService.getLiveLocations(user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get()
  findRecent(@CurrentUser() user: User, @Query('limit') limit?: string) {
    return this.telemetryService.findRecent(user, limit ? parseInt(limit) : 100);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':imei/stats')
  getStats(@Param('imei') imei: string) {
    return this.telemetryService.getVehicleStats(imei);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':imei/latest')
  getLatest(@Param('imei') imei: string) {
    return this.telemetryService.getLatest(imei);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':imei/history')
  getHistory(
    @Param('imei') imei: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.telemetryService.getHistory(imei, {
      limit: limit ? parseInt(limit) : 2000,
      from,
      to,
    });
  }
}
