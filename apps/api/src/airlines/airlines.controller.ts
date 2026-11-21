import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AllowVehicleSession, JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { AirlinesService, type AirlineVehicleSession, type ScannerLocation } from './airlines.service.js';

@ApiTags('airlines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('airlines')
export class AirlinesController {
  constructor(private readonly svc: AirlinesService) {}

  // ─── Airlines ───────────────────────────────────────────────────────────────

  @Get()
  list(@CurrentUser() user: User, @Query('organizationId') organizationId?: string, @Query('cityId') cityId?: string) {
    return this.svc.listAirlines(user, organizationId, cityId);
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
  getAirlineByVehicle(@CurrentUser() user: User, @Param('vehicleId') vehicleId: string) {
    return this.svc.getAirlineByVehicle(user, vehicleId);
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

  @Patch(':airlineId/vehicles/:vehicleId/pin')
  setVehiclePin(
    @CurrentUser() user: User,
    @Param('airlineId') airlineId: string,
    @Param('vehicleId') vehicleId: string,
    @Body('pin') pin: string,
  ) {
    return this.svc.setVehiclePin(user, airlineId, vehicleId, pin);
  }

  @Post(':airlineId/vehicles/:vehicleId/logout')
  forceLogoutVehicle(
    @CurrentUser() user: User,
    @Param('airlineId') airlineId: string,
    @Param('vehicleId') vehicleId: string,
  ) {
    return this.svc.forceLogoutVehicle(user, airlineId, vehicleId);
  }

  // ─── Vehicle session ping (used by app to detect admin force-logout) ────────

  @AllowVehicleSession(true)
  @Get('vehicles/ping')
  vehiclePing() { return { ok: true }; }

  @AllowVehicleSession(true)
  @Get('vehicles/session')
  getVehicleSession(@CurrentUser() session: AirlineVehicleSession) {
    return this.svc.getVehicleSession(session);
  }

  @AllowVehicleSession(true)
  @Delete('vehicles/session')
  endVehicleSession(@CurrentUser() session: AirlineVehicleSession) {
    return this.svc.endVehicleSession(session);
  }

  // ─── Trips ──────────────────────────────────────────────────────────────────

  @AllowVehicleSession(true)
  @Post('trips/checkin')
  checkin(@CurrentUser() session: AirlineVehicleSession, @Body() body: { nfcUid: string; vehicleId: string; flightNumber?: string; flightDate?: string; passengerCount?: number; notes?: string; location?: ScannerLocation }) {
    return this.svc.checkin(session, body);
  }

  @AllowVehicleSession(true)
  @Post('trips/checkout')
  checkout(@CurrentUser() session: AirlineVehicleSession, @Body() body: { nfcUid: string; location?: ScannerLocation }) {
    return this.svc.checkout(session, body);
  }

  @Get('trips/grouped')
  listGroupedTrips(
    @CurrentUser() user: User,
    @Query('airlineId') airlineId?: string,
    @Query('vehicleId') vehicleId?: string,
    @Query('crewName') crewName?: string,
    @Query('stop') stop?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listGroupedTrips(user, {
      airlineId, vehicleId, crewName, stop, status, from, to,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('trips/grouped/:groupId/detail')
  getGroupedTripDetail(@CurrentUser() user: User, @Param('groupId') groupId: string, @Query('crewTripId') crewTripId?: string) {
    return this.svc.getGroupedTripDetail(user, groupId, crewTripId);
  }

  @Get('trips/:tripId/eta')
  getCrewTripEta(@CurrentUser() user: User, @Param('tripId', new ParseUUIDPipe()) tripId: string) {
    return this.svc.getCrewTripEta(user, tripId);
  }

  @Delete('trips/bulk')
  deleteCrewTrips(@CurrentUser() user: User, @Body('tripIds') tripIds: string[]) {
    return this.svc.deleteCrewTrips(user, tripIds);
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

  @AllowVehicleSession(true)
  @Get('crews/lookup-uid')
  lookupCrewByPartialUid(@CurrentUser() session: AirlineVehicleSession, @Query('digits') digits: string) {
    return this.svc.lookupCrewByPartialUid(session, digits);
  }

  @AllowVehicleSession(true)
  @Get('trips/scan-status')
  scanStatus(@CurrentUser() session: AirlineVehicleSession, @Query('nfcUid') nfcUid: string) {
    return this.svc.getActiveTripByNfc(session, nfcUid);
  }

  @AllowVehicleSession(true)
  @Get('trips/active-trips')
  activeTripsForVehicle(@CurrentUser() session: AirlineVehicleSession, @Query('vehicleId') vehicleId: string) {
    return this.svc.getActiveTripsForVehicle(session, vehicleId);
  }

  // ─── Airport Settings ────────────────────────────────────────────────────────

  @Get('settings/airports')
  listAirports(@CurrentUser() user: User) { return this.svc.listAirports(user); }

  @Post('settings/airports')
  createAirport(@CurrentUser() user: User, @Body() body: { name: string; iataCode?: string; cityId?: string; lat: number; lng: number }) {
    return this.svc.createAirport(user, body);
  }

  @Put('settings/airports/:id')
  updateAirport(@CurrentUser() user: User, @Param('id') id: string, @Body() body: { name?: string; iataCode?: string; cityId?: string; lat?: number; lng?: number }) {
    return this.svc.updateAirport(user, id, body);
  }

  @Delete('settings/airports/:id')
  deleteAirport(@CurrentUser() user: User, @Param('id') id: string) { return this.svc.deleteAirport(user, id); }
}
