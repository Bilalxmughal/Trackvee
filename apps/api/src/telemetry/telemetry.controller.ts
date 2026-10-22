import { createHmac, timingSafeEqual } from 'node:crypto';
import { Controller, Get, Post, Param, Query, Body, UseGuards, Headers, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service.js';
import { DevicesService } from '../devices/devices.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { assertClientFeatureAccess } from '../org-permissions/client-feature-access.js';

const ADMIN_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@ApiTags('telemetry')
@Controller('telemetry')
export class TelemetryController {
  constructor(
    private telemetryService: TelemetryService,
    private devicesService: DevicesService,
    private orgPermissions: OrgPermissionsService,
    private rolePermissions: RolePortalPermissionsService,
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
  @Get('fleet-mileage')
  getFleetMileage(@CurrentUser() user: User) {
    return this.telemetryService.getFleetMileage(user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('device-health')
  async getDeviceHealth(@CurrentUser() user: User, @Query('cityId') cityId?: string) {
    if (!ADMIN_ROLES.includes(user.role)) {
      await assertClientFeatureAccess(user, 'vehicles', 'view', this.orgPermissions, this.rolePermissions);
    }
    return this.telemetryService.getDeviceHealth(user, cityId);
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
  async getStats(@CurrentUser() user: User, @Param('imei') imei: string) {
    if (!ADMIN_ROLES.includes(user.role)) {
      const allowedDevices = await this.devicesService.findAll(user);
      if (!allowedDevices.some(device => device.imei === imei)) throw new NotFoundException();
    }
    return this.telemetryService.getVehicleStats(imei);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':imei/latest')
  async getLatest(@CurrentUser() user: User, @Param('imei') imei: string) {
    if (!ADMIN_ROLES.includes(user.role)) {
      const allowedDevices = await this.devicesService.findAll(user);
      if (!allowedDevices.some(device => device.imei === imei)) throw new NotFoundException();
    }
    return this.telemetryService.getLatest(imei);
  }

  @Get('live-public/:token')
  async getLivePublic(@Param('token') token: string) {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) throw new BadRequestException('Invalid token');
    const secret = process.env['SHARE_SECRET'] ?? process.env['JWT_SECRET'] ?? 'change-me';
    const expectedSig = createHmac('sha256', secret).update(payload).digest('hex');
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) throw new UnauthorizedException('Invalid share token');
    let parsed: { vehicleId: string; expiresAt: number };
    try { parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
    catch { throw new BadRequestException('Malformed token'); }
    if (!parsed.vehicleId || !parsed.expiresAt || Date.now() > parsed.expiresAt) throw new UnauthorizedException('Share link expired');
    const device = await this.devicesService.findByVehicleId(parsed.vehicleId);
    if (!device) throw new NotFoundException('Vehicle not found');
    const latest = await this.telemetryService.getLatest(device.imei);
    return {
      vehicle: { id: device.vehicle?.id, licensePlate: device.vehicle?.licensePlate, name: device.vehicle?.name, make: device.vehicle?.make, model: device.vehicle?.model },
      point: latest,
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get(':imei/history')
  async getHistory(
    @CurrentUser() user: User,
    @Param('imei') imei: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!ADMIN_ROLES.includes(user.role)) {
      const allowedDevices = await this.devicesService.findAll(user);
      if (!allowedDevices.some(device => device.imei === imei)) throw new NotFoundException();
    }
    const requestedLimit = Number.parseInt(limit ?? '', 10);
    const requestedOffset = Number.parseInt(offset ?? '', 10);
    return this.telemetryService.getHistory(imei, {
      limit: Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(requestedLimit, 2000) : 2000,
      offset: Number.isFinite(requestedOffset) && requestedOffset > 0 ? requestedOffset : 0,
      from,
      to,
    });
  }
}
