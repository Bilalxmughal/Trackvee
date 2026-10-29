import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { AirlinesService } from './airlines.service.js';

@ApiTags('airlines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('airlines')
export class AirlinesController {
  constructor(private readonly svc: AirlinesService) {}

  // ─── Airlines ───────────────────────────────────────────────────────────────

  @Get()
  list(@CurrentUser() user: User, @Query('organizationId') organizationId?: string) {
    return this.svc.listAirlines(user, organizationId);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() body: any) {
    return this.svc.createAirline(user, body);
  }

  @Put(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateAirline(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.svc.deleteAirline(user, id);
  }

  // ─── Crews ──────────────────────────────────────────────────────────────────

  @Get(':airlineId/crews')
  listCrews(@CurrentUser() user: User, @Param('airlineId') airlineId: string) {
    return this.svc.listCrews(user, airlineId);
  }

  @Post(':airlineId/crews')
  createCrew(@CurrentUser() user: User, @Param('airlineId') airlineId: string, @Body() body: any) {
    return this.svc.createCrew(user, airlineId, body);
  }

  @Put(':airlineId/crews/:crewId')
  updateCrew(
    @CurrentUser() user: User,
    @Param('airlineId') airlineId: string,
    @Param('crewId') crewId: string,
    @Body() body: any,
  ) {
    return this.svc.updateCrew(user, airlineId, crewId, body);
  }

  @Delete(':airlineId/crews/:crewId')
  deleteCrew(
    @CurrentUser() user: User,
    @Param('airlineId') airlineId: string,
    @Param('crewId') crewId: string,
  ) {
    return this.svc.deleteCrew(user, airlineId, crewId);
  }

  // ─── Vehicle Assignment ──────────────────────────────────────────────────────

  @Get('by-vehicle/:vehicleId')
  getAirlineByVehicle(@Param('vehicleId') vehicleId: string) {
    return this.svc.getAirlineByVehicle(vehicleId);
  }

  @Get(':airlineId/vehicles')
  listVehicles(@CurrentUser() user: User, @Param('airlineId') airlineId: string) {
    return this.svc.listAssignedVehicles(user, airlineId);
  }

  @Post(':airlineId/vehicles')
  assignVehicle(
    @CurrentUser() user: User,
    @Param('airlineId') airlineId: string,
    @Body('vehicleId') vehicleId: string,
  ) {
    return this.svc.assignVehicle(user, airlineId, vehicleId);
  }

  @Delete(':airlineId/vehicles/:vehicleId')
  unassignVehicle(
    @CurrentUser() user: User,
    @Param('airlineId') airlineId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.svc.unassignVehicle(user, airlineId, vehicleId);
  }

  // ─── Trips ──────────────────────────────────────────────────────────────────

  @Post('trips/checkin')
  checkin(@Body() body: { nfcUid: string; vehicleId: string; flightNumber?: string; lat: number; lng: number }) {
    return this.svc.checkin(body);
  }

  @Post('trips/checkout')
  checkout(@Body() body: { nfcUid: string; lat: number; lng: number }) {
    return this.svc.checkout(body);
  }

  @Get('trips/list')
  listTrips(
    @CurrentUser() user: User,
    @Query('airlineId') airlineId?: string,
    @Query('crewId') crewId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('flightNumber') flightNumber?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listTrips(user, {
      airlineId, crewId, vehicleId, flightNumber, status, from, to,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('trips/scan-status')
  scanStatus(@Query('nfcUid') nfcUid: string) {
    return this.svc.getActiveTripByNfc(nfcUid);
  }
}
