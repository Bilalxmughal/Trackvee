import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, LessThanOrEqual } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Airline } from './entities/airline.entity.js';
import { AirlineCrew } from './entities/airline-crew.entity.js';
import { AirlineVehicle } from './entities/airline-vehicle.entity.js';
import { CrewTrip, type ScanLocationSource } from './entities/crew-trip.entity.js';
import { AirlineAirport } from './entities/airline-airport.entity.js';
import { User } from '../users/entities/user.entity.js';

export interface ScannerLocation {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export interface AirlineVehicleSession {
  _isVehicle: true;
  sessionId: string;
  vehicleId: string;
  airlineId: string;
}

const VEHICLE_SESSION_SECONDS = 30 * 24 * 60 * 60;
const VEHICLE_LOGOUT_ROLES = new Set(['super_admin', 'admin', 'ops']);

const INTERNAL_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function routeDistance(points: { latitude: number; longitude: number; timestamp: Date }[]) {
  let distance = 0;
  let measuredSegments = 0;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const current = points[index];
    if (new Date(current.timestamp).getTime() - new Date(previous.timestamp).getTime() <= 600_000) {
      distance += haversineKm(previous.latitude, previous.longitude, current.latitude, current.longitude);
      measuredSegments++;
    }
  }
  return measuredSegments ? Math.round(distance * 100) / 100 : null;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Trackvee/1.0' }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = await res.json() as any;
    const a = data.address || {};
    return (
      a.road || a.neighbourhood || a.suburb || a.village || a.town || a.city ||
      data.display_name?.split(',')[0] ||
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`
    );
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

@Injectable()
export class AirlinesService {
  constructor(
    @InjectRepository(Airline)      private airlineRepo: Repository<Airline>,
    @InjectRepository(AirlineCrew)  private crewRepo: Repository<AirlineCrew>,
    @InjectRepository(AirlineVehicle) private avRepo: Repository<AirlineVehicle>,
    @InjectRepository(CrewTrip)     private tripRepo: Repository<CrewTrip>,
    @InjectRepository(AirlineAirport) private airportRepo: Repository<AirlineAirport>,
    private dataSource: DataSource,
    private jwtService: JwtService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private orgId(user: User): string | null {
    return INTERNAL_ROLES.includes(user.role) ? null : user.organizationId;
  }

  private isInternal(user: User): boolean {
    return INTERNAL_ROLES.includes(user.role);
  }

  private assertVehicleSession(session: AirlineVehicleSession, vehicleId = session?.vehicleId): void {
    if (session?._isVehicle !== true || !session.airlineId || !session.vehicleId || !session.sessionId || vehicleId !== session.vehicleId) {
      throw new ForbiddenException('Vehicle session required for this vehicle');
    }
  }

  private findCrewForSession(session: AirlineVehicleSession, nfcUid: string) {
    this.assertVehicleSession(session);
    if (typeof nfcUid !== 'string' || !nfcUid.trim()) {
      throw new BadRequestException('NFC card identifier is required');
    }
    return this.crewRepo.findOne({ where: { airlineId: session.airlineId, nfcCardUid: nfcUid } });
  }

  // ─── Airlines CRUD ───────────────────────────────────────────────────────────

  async listAirlines(user: User, organizationId?: string, cityId?: string) {
    const qb = this.airlineRepo.createQueryBuilder('a');
    if (!this.isInternal(user)) {
      qb.where('a.organization_id = :orgId', { orgId: user.organizationId });
    } else if (organizationId) {
      qb.where('a.organization_id = :orgId', { orgId: organizationId });
    }
    if (cityId) qb.andWhere('a.city_id = :cityId', { cityId });
    const airlines = await qb.orderBy('a.created_at', 'DESC').getMany();

    // Attach counts
    return Promise.all(airlines.map(async (a) => {
      const [crewCount, vehicleCount] = await Promise.all([
        this.crewRepo.count({ where: { airlineId: a.id } }),
        this.avRepo.count({ where: { airlineId: a.id } }),
      ]);
      return { ...a, crewCount, vehicleCount };
    }));
  }

  async getAirline(user: User, id: string) {
    const a = await this.airlineRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Airline not found');
    if (!this.isInternal(user) && (!user.organizationId || a.organizationId !== user.organizationId)) throw new NotFoundException();
    return a;
  }

  async createAirline(user: User, body: Partial<Airline>) {
    const airline = this.airlineRepo.create({
      ...body,
      organizationId: this.isInternal(user) ? (body.organizationId ?? null) : user.organizationId,
    });
    return this.airlineRepo.save(airline);
  }

  async updateAirline(user: User, id: string, body: Partial<Airline>) {
    const a = await this.getAirline(user, id);
    Object.assign(a, body);
    return this.airlineRepo.save(a);
  }

  async deleteAirline(user: User, id: string) {
    const a = await this.getAirline(user, id);
    await this.airlineRepo.remove(a);
    return { success: true };
  }

  // ─── Crews CRUD ──────────────────────────────────────────────────────────────

  async listCrews(user: User, airlineId: string) {
    await this.getAirline(user, airlineId); // access check
    return this.crewRepo.find({
      where: { airlineId },
      order: { displayId: 'ASC' },
    });
  }

  async getCrew(id: string) {
    const c = await this.crewRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Crew not found');
    return c;
  }

  async createCrew(user: User, airlineId: string, body: Partial<AirlineCrew>) {
    await this.getAirline(user, airlineId);

    if (body.nfcCardUid) {
      const existing = await this.crewRepo.findOne({ where: { nfcCardUid: body.nfcCardUid } });
      if (existing) throw new BadRequestException('NFC card already assigned to another crew member');
    }

    const crew = this.crewRepo.create({ ...body, airlineId });
    return this.crewRepo.save(crew);
  }

  async updateCrew(user: User, airlineId: string, crewId: string, body: Partial<AirlineCrew>) {
    await this.getAirline(user, airlineId);
    const crew = await this.getCrew(crewId);

    if (body.nfcCardUid && body.nfcCardUid !== crew.nfcCardUid) {
      const existing = await this.crewRepo.findOne({ where: { nfcCardUid: body.nfcCardUid } });
      if (existing && existing.id !== crewId) throw new BadRequestException('NFC card already assigned to another crew member');
    }

    Object.assign(crew, body);
    return this.crewRepo.save(crew);
  }

  async deleteCrew(user: User, airlineId: string, crewId: string) {
    await this.getAirline(user, airlineId);
    const crew = await this.getCrew(crewId);
    await this.crewRepo.remove(crew);
    return { success: true };
  }

  // ─── Vehicle Assignment ───────────────────────────────────────────────────────

  async listAssignedVehicles(user: User, airlineId: string) {
    await this.getAirline(user, airlineId);
    const vehicles = await this.dataSource.query(
      `SELECT v.id, v.display_id, v.name, v.license_plate, v.make, v.model, v.type, v.lifecycle_status, v.city_id,
              (av.pin_hash IS NOT NULL) AS has_pin,
              av.last_login_at, av.session_revoked_at, COALESCE(av.active_session_id IS NOT NULL AND av.last_login_at > $2, false) AS has_active_session
       FROM airline_vehicles av
       JOIN vehicles v ON v.id = av.vehicle_id
       WHERE av.airline_id = $1`,
      [airlineId, new Date(Date.now() - VEHICLE_SESSION_SECONDS * 1000)],
    );
    return vehicles;
  }

  async setVehiclePin(user: User, airlineId: string, vehicleId: string, pin: string) {
    if (!/^\d{4}$/.test(pin)) throw new BadRequestException('PIN must be exactly 4 digits');
    await this.getAirline(user, airlineId);
    const updated = await this.avRepo.update(
      { airlineId, vehicleId },
      { pinHash: await bcrypt.hash(pin, 10), activeSessionId: null, sessionRevokedAt: new Date() },
    );
    if (!updated.affected) throw new NotFoundException('Vehicle not assigned to this airline');
    return { success: true };
  }

  async forceLogoutVehicle(user: User, airlineId: string, vehicleId: string) {
    if (!VEHICLE_LOGOUT_ROLES.has(user.role)) throw new ForbiddenException('You cannot force logout this vehicle');
    await this.getAirline(user, airlineId);
    const revoked = await this.avRepo.update(
      { airlineId, vehicleId },
      { activeSessionId: null, sessionRevokedAt: new Date() },
    );
    if (!revoked.affected) throw new NotFoundException('Vehicle not assigned to this airline');
    return { success: true };
  }

  private vehicleSessionData(row: {
    vehicle_id: string; vehicle_name: string; license_plate: string | null; display_id: number;
    airline_id: string; airline_name: string; iata_code: string | null; logo_data: string | null;
  }) {
    return {
      vehicleId: row.vehicle_id, vehicleName: row.vehicle_name, licensePlate: row.license_plate, displayId: row.display_id,
      airlineId: row.airline_id, airlineName: row.airline_name, iataCode: row.iata_code, logoData: row.logo_data ?? null,
    };
  }

  async vehicleLogin(plateNumber: string, pin: string) {
    if (typeof plateNumber !== 'string' || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      throw new UnauthorizedException('Invalid plate number or PIN');
    }
    const plate = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!plate || plate.length > 32) throw new UnauthorizedException('Invalid plate number or PIN');
    const rows = await this.dataSource.query(
      `SELECT av.id, av.pin_hash, v.id AS vehicle_id, v.name AS vehicle_name, v.license_plate, v.display_id,
              a.id AS airline_id, a.name AS airline_name, a.iata_code, a.logo_data
       FROM airline_vehicles av
       JOIN vehicles v ON v.id = av.vehicle_id
       JOIN airlines a ON a.id = av.airline_id
       WHERE REGEXP_REPLACE(UPPER(v.license_plate), '[^A-Z0-9]', '', 'g') = $1
         AND av.pin_hash IS NOT NULL`,
      [plate],
    );
    const matches = [];
    for (const row of rows) {
      if (await bcrypt.compare(pin, row.pin_hash)) matches.push(row);
    }
    if (matches.length !== 1) throw new UnauthorizedException('Invalid plate number or PIN');
    const row = matches[0];
    const sessionId = randomUUID();
    const now = new Date(Math.floor(Date.now() / 1000) * 1000);
    const expiredBefore = new Date(now.getTime() - VEHICLE_SESSION_SECONDS * 1000);
    const assignment = { id: row.id, pinHash: row.pin_hash };
    const updated = await this.avRepo.update(
      [
        { ...assignment, activeSessionId: IsNull() },
        { ...assignment, lastLoginAt: LessThanOrEqual(expiredBefore) },
      ],
      { activeSessionId: sessionId, lastLoginAt: now, sessionRevokedAt: null },
    );
    if (!updated.affected) {
      throw new ConflictException('This vehicle already has an active session. Ask an administrator to force logout.');
    }
    const token = this.jwtService.sign({
      sub: `vehicle:${row.vehicle_id}`, vehicleId: row.vehicle_id,
      airlineId: row.airline_id, type: 'vehicle', sessionId, iat: now.getTime() / 1000,
    }, { expiresIn: VEHICLE_SESSION_SECONDS });
    return { token, ...this.vehicleSessionData(row) };
  }

  async getVehicleSession(session: AirlineVehicleSession) {
    this.assertVehicleSession(session);
    const [row] = await this.dataSource.query(
      `SELECT v.id AS vehicle_id, v.name AS vehicle_name, v.license_plate, v.display_id,
              a.id AS airline_id, a.name AS airline_name, a.iata_code, a.logo_data
       FROM airline_vehicles av
       JOIN vehicles v ON v.id = av.vehicle_id
       JOIN airlines a ON a.id = av.airline_id
       WHERE av.vehicle_id = $1 AND av.airline_id = $2 AND av.active_session_id = $3`,
      [session.vehicleId, session.airlineId, session.sessionId],
    );
    if (!row) throw new UnauthorizedException('Vehicle session ended');
    return this.vehicleSessionData(row);
  }

  async lookupCrewByPartialUid(session: AirlineVehicleSession, digits: string): Promise<{ nfcUid: string }> {
    this.assertVehicleSession(session);
    if (!digits || !/^[a-z0-9]{1,8}$/i.test(digits)) throw new BadRequestException('Enter 1–8 alphanumeric characters');
    try {
      const result = await this.dataSource.query(
        `SELECT nfc_card_uid FROM airline_crews
         WHERE airline_id = $2 AND nfc_card_uid IS NOT NULL
           AND REPLACE(REPLACE(nfc_card_uid, ':', ''), '-', '') ILIKE $1`,
        [`%${digits}`, session.airlineId],
      );
      if (result.length === 0) throw new NotFoundException('No crew card found with those digits');
      if (result.length > 1) throw new BadRequestException('Multiple cards match — enter more digits');
      return { nfcUid: result[0].nfc_card_uid };
    } catch (err) {
      if (err instanceof NotFoundException || err instanceof BadRequestException) throw err;
      throw new BadRequestException('Could not search cards — please try again');
    }
  }

  async assignVehicle(user: User, airlineId: string, vehicleId: string) {
    await this.getAirline(user, airlineId);
    const existing = await this.avRepo.findOne({ where: { airlineId, vehicleId } });
    if (existing) return existing;
    const av = this.avRepo.create({ airlineId, vehicleId });
    return this.avRepo.save(av);
  }

  async unassignVehicle(user: User, airlineId: string, vehicleId: string) {
    await this.getAirline(user, airlineId);
    await this.avRepo.delete({ airlineId, vehicleId });
    return { success: true };
  }

  async getAirlineByVehicle(user: User, vehicleId: string) {
    if (!this.isInternal(user)) throw new ForbiddenException();
    const row = await this.avRepo.findOne({ where: { vehicleId } });
    if (!row) return null;
    const airline = await this.airlineRepo.findOne({ where: { id: row.airlineId } });
    return airline ? { id: airline.id, name: airline.name, iataCode: airline.iataCode } : null;
  }

  private async tripRoute(vehicleId: string, from: Date, to: Date, latestOnly = false) {
    const points: { latitude: number; longitude: number; speed: number; heading: number; ignition: boolean | null; timestamp: Date }[] = [];
    const pageSize = latestOnly ? 1 : 2000;
    const direction = latestOnly ? 'DESC' : 'ASC';
    for (let offset = 0;; offset += pageSize) {
      const page = await this.dataSource.query(
        `SELECT t.latitude, t.longitude, t.speed_kmh AS speed, t.heading, t.ignition, t.timestamp
         FROM telemetry t
         WHERE t.timestamp BETWEEN $2 AND $3 AND t.gps_valid = true
           AND t.latitude BETWEEN -90 AND 90 AND t.longitude BETWEEN -180 AND 180
           AND (t.latitude <> 0 OR t.longitude <> 0)
           AND EXISTS (
             SELECT 1 FROM device_assignments a JOIN devices d ON d.id = a.device_id
             WHERE a.vehicle_id = $1 AND d.imei = t.imei AND a.assigned_at <= t.timestamp
               AND (a.unassigned_at IS NULL OR a.unassigned_at > t.timestamp)
           )
         ORDER BY t.timestamp ${direction}, t.id ${direction}
         LIMIT $4 OFFSET $5`,
        [vehicleId, from, to, pageSize, offset],
      );
      points.push(...page);
      if (latestOnly || page.length < pageSize) return points;
    }
  }

  private async scanLocation(vehicleId: string, scannedAt: Date, scanner?: ScannerLocation) {
    const age = scanner ? scannedAt.getTime() - scanner.timestamp : Infinity;
    const validScanner = scanner && Number.isFinite(scanner.timestamp) && age >= -5_000 && age <= 30_000
      && Number.isFinite(scanner.latitude) && Math.abs(scanner.latitude) <= 90
      && Number.isFinite(scanner.longitude) && Math.abs(scanner.longitude) <= 180
      && (scanner.latitude !== 0 || scanner.longitude !== 0)
      && typeof scanner.accuracy === 'number' && scanner.accuracy > 0 && scanner.accuracy <= 100;
    const [point] = validScanner
      ? [scanner]
      : await this.tripRoute(vehicleId, new Date(scannedAt.getTime() - 2 * 60_000), scannedAt, true);
    const source: ScanLocationSource = validScanner ? 'scanner_gps' : point ? 'vehicle_tracker' : 'unavailable';
    return {
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      stop: point ? await reverseGeocode(point.latitude, point.longitude) : null,
      source,
    };
  }

  private async estimateArrival(vehicleId: string, latitude: number | null, longitude: number | null) {
    const origin = process.env.AIRLINE_ROUTING_BASE_URL?.trim();
    if (!origin || latitude == null || longitude == null) return null;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null;
    const estimatedAt = new Date();
    const [fix] = await this.tripRoute(vehicleId, new Date(estimatedAt.getTime() - 120_000), estimatedAt, true);
    if (!fix) return null;
    try {
      const url = new URL(`${origin.replace(/\/$/, '')}/route/v1/driving/${fix.longitude},${fix.latitude};${longitude},${latitude}`);
      url.searchParams.set('overview', 'false');
      const response = await fetch(url, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) return null;
      const data = await response.json() as { code?: string; routes?: { duration: number; distance: number }[] };
      const route = data.routes?.[0];
      if (data.code !== 'Ok' || !route || !Number.isFinite(route.duration) || route.duration < 0
        || !Number.isFinite(route.distance) || route.distance < 0) return null;
      return { arrivalAt: new Date(estimatedAt.getTime() + route.duration * 1000), estimatedAt, remainingKm: route.distance / 1000 };
    } catch {
      return null;
    }
  }

  // ─── Trips: Check-in / Check-out ─────────────────────────────────────────────

  async checkin(session: AirlineVehicleSession, body: { nfcUid: string; vehicleId: string; flightNumber?: string; flightDate?: string; passengerCount?: number; notes?: string; location?: ScannerLocation }) {
    this.assertVehicleSession(session, body.vehicleId);
    if (!body.vehicleId) throw new BadRequestException('Vehicle identifier is required');
    const crew = await this.findCrewForSession(session, body.nfcUid);
    if (!crew) throw new NotFoundException('NFC card not registered');
    if (crew.status === 'inactive') throw new BadRequestException(`${crew.name} is inactive and cannot check in`);

    const open = await this.tripRepo.findOne({ where: { crewId: crew.id, status: 'in_progress' } });
    if (open) throw new BadRequestException(`${crew.name} already checked in (trip ${open.id})`);

    const airline = await this.airlineRepo.findOne({ where: { id: crew.airlineId } });
    const scannedAt = new Date();
    const [location, initialEta] = await Promise.all([
      this.scanLocation(session.vehicleId, scannedAt, body.location),
      this.estimateArrival(session.vehicleId, crew.stopLat, crew.stopLng).catch(() => null),
    ]);

    // Get vehicle odometer from vehicles table
    const [veh] = await this.dataSource.query(
      `SELECT odometer_km FROM vehicles WHERE id = $1`, [body.vehicleId],
    );

    const trip = this.tripRepo.create({
      crewId: crew.id,
      vehicleId: body.vehicleId,
      airlineId: crew.airlineId,
      flightNumber: body.flightNumber ?? null,
      flightDate: body.flightDate ?? null,
      passengerCount: body.passengerCount ?? null,
      notes: body.notes ?? null,
      status: 'in_progress',
      checkinAt: scannedAt,
      checkinLat: location.latitude,
      checkinLng: location.longitude,
      checkinStop: location.stop,
      checkinLocationSource: location.source,
      checkinOdometerKm: veh?.odometer_km ?? null,
      plannedStop: crew.stopName,
      plannedLat: crew.stopLat,
      plannedLng: crew.stopLng,
      initialEtaAt: initialEta?.arrivalAt ?? null,
    });
    const saved = await this.tripRepo.save(trip);

    return {
      tripId: saved.id,
      crew: { id: crew.id, displayId: crew.displayId, name: crew.name, designation: crew.designation },
      airline: airline ? { id: airline.id, name: airline.name } : null,
      checkinAt: saved.checkinAt,
      checkinStop: location.stop,
      checkinLocationSource: location.source,
    };
  }

  async checkout(session: AirlineVehicleSession, body: { nfcUid: string; location?: ScannerLocation }) {
    const crew = await this.findCrewForSession(session, body.nfcUid);
    if (!crew) throw new NotFoundException('NFC card not registered');

    const trip = await this.tripRepo.findOne({ where: { crewId: crew.id, airlineId: session.airlineId, vehicleId: session.vehicleId, status: 'in_progress' } });
    if (!trip) throw new BadRequestException(`${crew.name} is not checked in`);

    const scannedAt = new Date();
    const location = await this.scanLocation(session.vehicleId, scannedAt, body.location);

    // Get vehicle current odometer
    const [veh] = await this.dataSource.query(
      `SELECT odometer_km FROM vehicles WHERE id = $1`, [trip.vehicleId],
    );
    const checkoutOdometer = veh?.odometer_km ?? null;

    // Calculate KM from telemetry GPS path between checkin and now
    let kmTravelled: number | null = null;
    try {
      if (trip.checkinAt) {
        const points = await this.tripRoute(trip.vehicleId, trip.checkinAt, scannedAt);
        kmTravelled = routeDistance(points);
      }
    } catch {
      // KM calculation failed — leave as null
    }

    trip.checkoutAt = scannedAt;
    trip.checkoutLat = location.latitude;
    trip.checkoutLng = location.longitude;
    trip.checkoutStop = location.stop;
    trip.checkoutLocationSource = location.source;
    trip.checkoutOdometerKm = checkoutOdometer;
    trip.kmTravelled = kmTravelled !== null ? String(kmTravelled) : null;
    trip.status = 'completed';

    const saved = await this.tripRepo.save(trip);
    return {
      tripId: saved.id,
      crew: { id: crew.id, displayId: crew.displayId, name: crew.name },
      checkoutAt: saved.checkoutAt,
      checkoutStop: location.stop,
      checkoutLocationSource: location.source,
      kmTravelled,
    };
  }

  // ─── Trip Listing ─────────────────────────────────────────────────────────────

  async listTrips(user: User, filters: {
    airlineId?: string;
    crewId?: string;
    vehicleId?: string;
    flightNumber?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    const qb = this.dataSource.createQueryBuilder()
      .select([
        't.id', 't.flight_number', 't.status',
        't.checkin_at', 't.checkin_stop', 't.checkin_lat', 't.checkin_lng', 't.checkin_location_source',
        't.checkout_at', 't.checkout_stop', 't.checkout_lat', 't.checkout_lng', 't.checkout_location_source',
        't.km_travelled', 't.created_at',
        'c.id AS crew_id', 'c.display_id AS crew_display_id', 'c.name AS crew_name', 'c.designation AS crew_designation',
        'v.id AS vehicle_id', 'v.name AS vehicle_name', 'v.license_plate',
        'a.id AS airline_id', 'a.name AS airline_name',
      ])
      .from('crew_trips', 't')
      .leftJoin('airline_crews', 'c', 'c.id = t.crew_id')
      .leftJoin('vehicles', 'v', 'v.id = t.vehicle_id')
      .leftJoin('airlines', 'a', 'a.id = t.airline_id');

    if (!this.isInternal(user)) {
      qb.where('a.organization_id = :orgId', { orgId: user.organizationId });
    }
    if (filters.airlineId)    qb.andWhere('t.airline_id = :airlineId',    { airlineId: filters.airlineId });
    if (filters.crewId)       qb.andWhere('t.crew_id = :crewId',          { crewId: filters.crewId });
    if (filters.vehicleId)    qb.andWhere('t.vehicle_id = :vehicleId',    { vehicleId: filters.vehicleId });
    if (filters.flightNumber) qb.andWhere('t.flight_number = :fn',        { fn: filters.flightNumber });
    if (filters.status)       qb.andWhere('t.status = :status',           { status: filters.status });
    if (filters.from)         qb.andWhere('t.checkin_at >= :from',        { from: filters.from });
    if (filters.to)           qb.andWhere('t.checkin_at <= :to',          { to: filters.to });

    const total = await qb.getCount();
    const rows = await qb.orderBy('t.checkin_at', 'DESC').limit(limit).offset(offset).getRawMany();

    return { total, page, limit, rows };
  }

  async getActiveTripByNfc(session: AirlineVehicleSession, nfcUid: string) {
    const crew = await this.findCrewForSession(session, nfcUid);
    if (!crew) return null;
    const trip = await this.tripRepo.findOne({ where: { crewId: crew.id, airlineId: session.airlineId, vehicleId: session.vehicleId, status: 'in_progress' } });
    // Always return crew info so app can show name on checkin flow too
    return { trip: trip ?? null, crew };
  }

  async getActiveTripsForVehicle(session: AirlineVehicleSession, vehicleId: string) {
    this.assertVehicleSession(session, vehicleId);
    const rows = await this.dataSource.query(
      `SELECT t.id AS trip_id, t.checkin_at, c.name AS crew_name, c.designation
       FROM crew_trips t
       JOIN airline_crews c ON c.id = t.crew_id
       WHERE t.vehicle_id = $1 AND t.airline_id = $2 AND t.status = 'in_progress'
       ORDER BY t.checkin_at ASC`,
      [session.vehicleId, session.airlineId],
    );
    return rows.map((r: any) => ({
      tripId: r.trip_id,
      crewName: r.crew_name,
      designation: r.designation ?? null,
      checkinAt: r.checkin_at,
    }));
  }

  // ─── Grouped Trips (vehicle-level grouping by 5-min window) ──────────────────

  async listGroupedTrips(user: User, filters: {
    airlineId?: string; vehicleId?: string; crewName?: string;
    stop?: string; status?: string; from?: string; to?: string;
    page?: number; limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 50, 200);
    const offset = (page - 1) * limit;

    const params: any[] = [];
    const conditions: string[] = [];

    if (!this.isInternal(user)) {
      params.push(user.organizationId); conditions.push(`a.organization_id = $${params.length}`);
    }
    if (filters.airlineId)  { params.push(filters.airlineId);         conditions.push(`t.airline_id = $${params.length}`); }
    if (filters.vehicleId)  { params.push(filters.vehicleId);         conditions.push(`t.vehicle_id = $${params.length}`); }
    if (filters.crewName)   { params.push(`%${filters.crewName}%`);   conditions.push(`c.name ILIKE $${params.length}`); }
    if (filters.stop)       { params.push(`%${filters.stop}%`);       conditions.push(`(t.checkin_stop ILIKE $${params.length} OR t.checkout_stop ILIKE $${params.length})`); }
    if (filters.status)     { params.push(filters.status);            conditions.push(`t.status = $${params.length}`); }
    if (filters.from)       { params.push(filters.from);              conditions.push(`t.checkin_at >= $${params.length}`); }
    if (filters.to)         { params.push(filters.to);                conditions.push(`t.checkin_at <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const groupBy = `
      t.vehicle_id, v.name, v.license_plate, v.make, v.model, v.display_id,
      t.flight_number, t.airline_id, a.name,
      (FLOOR(EXTRACT(EPOCH FROM t.checkin_at) / 300))::bigint
    `;

    const innerSql = `
      FROM crew_trips t
      LEFT JOIN vehicles v ON v.id = t.vehicle_id
      LEFT JOIN airlines a ON a.id = t.airline_id
      LEFT JOIN airline_crews c ON c.id = t.crew_id
      ${where}
      GROUP BY ${groupBy}
    `;

    const countParams = [...params];
    const [countResult] = await this.dataSource.query(
      `SELECT COUNT(*) FROM (SELECT 1 ${innerSql}) sub`, countParams,
    );

    params.push(limit);  const limitIdx  = params.length;
    params.push(offset); const offsetIdx = params.length;

    const rows = await this.dataSource.query(`
      SELECT
        (ARRAY_AGG(t.id ORDER BY t.checkin_at, t.id))[1]                  AS group_id,
        MIN(t.display_id)                                            AS display_id,
        COUNT(t.id)::int                                             AS crew_count,
        t.vehicle_id,
        v.name                                                       AS vehicle_name,
        v.license_plate,
        v.make,
        v.model,
        v.display_id                                                 AS vehicle_display_id,
        t.flight_number,
        t.airline_id,
        a.name                                                       AS airline_name,
        (ARRAY_AGG(t.checkin_stop ORDER BY t.checkin_at, t.id))[1] AS origin,
        (ARRAY_AGG(t.checkin_lat ORDER BY t.checkin_at, t.id))[1] AS origin_lat,
        (ARRAY_AGG(t.checkin_lng ORDER BY t.checkin_at, t.id))[1] AS origin_lng,
        MIN(t.checkin_at)                                            AS checkin_at,
        MAX(t.checkout_at)                                           AS checkout_at,
        MAX(CAST(t.km_travelled AS FLOAT)) AS km_travelled,
        CASE WHEN bool_or(t.status = 'in_progress') THEN 'in_progress' ELSE 'completed' END AS status,
        STRING_AGG(DISTINCT c.name, ', ' ORDER BY c.name)           AS crew_names,
        ARRAY_AGG(t.id ORDER BY t.checkin_at, t.id)                       AS trip_ids
      ${innerSql}
      ORDER BY MIN(t.checkin_at) DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, params);

    return { total: parseInt(countResult?.count ?? '0'), page, limit, rows };
  }

  async getGroupedTripDetail(user: User, groupId: string, crewTripId?: string) {
    const [ref] = await this.dataSource.query(
      `SELECT t.*, v.name AS vehicle_name, v.license_plate, v.display_id AS vehicle_display_id,
              v.make, v.model, v.year, v.type
       FROM crew_trips t LEFT JOIN vehicles v ON v.id = t.vehicle_id WHERE t.id = $1`, [groupId],
    );
    if (!ref) throw new NotFoundException('Trip not found');
    await this.getAirline(user, ref.airline_id);

    const trips = await this.dataSource.query(`
      SELECT t.id, t.status, t.checkin_at, t.checkin_stop, t.checkin_lat, t.checkin_lng, t.checkin_location_source,
             t.checkout_at, t.checkout_stop, t.checkout_lat, t.checkout_lng, t.checkout_location_source, t.km_travelled, t.flight_number,
             t.planned_stop, t.planned_lat, t.planned_lng, t.initial_eta_at,
             c.name AS crew_name, c.display_id AS crew_display_id, c.designation AS crew_designation, c.phone AS crew_phone
      FROM crew_trips t
      LEFT JOIN airline_crews c ON c.id = t.crew_id
      WHERE t.vehicle_id = $1
        AND t.airline_id = $4
        AND t.flight_number IS NOT DISTINCT FROM $2
        AND FLOOR(EXTRACT(EPOCH FROM t.checkin_at) / 300) = FLOOR(EXTRACT(EPOCH FROM $3::timestamptz) / 300)
      ORDER BY t.checkin_at ASC, t.id ASC
    `, [ref.vehicle_id, ref.flight_number, ref.checkin_at, ref.airline_id]);

    const selected = trips.find((trip: { id: string }) => trip.id === (crewTripId ?? groupId));
    if (!selected) throw new NotFoundException('Crew trip not found in this group');
    const windowEnd = selected.checkout_at ?? new Date();
    const [route, eta] = await Promise.all([
      selected.checkin_at ? this.tripRoute(ref.vehicle_id, selected.checkin_at, windowEnd) : [],
      selected.status === 'in_progress'
        ? this.estimateArrival(ref.vehicle_id, selected.planned_lat, selected.planned_lng).catch(() => null)
        : null,
    ]);

    const checkinAt = new Date(selected.checkin_at).getTime();
    const endAt = new Date(windowEnd).getTime();
    const incompleteCoverage = route.length < 2
      || new Date(route[0].timestamp).getTime() - checkinAt > 120_000
      || endAt - new Date(route[route.length - 1].timestamp).getTime() > 120_000
      || route.some((point, index) => index > 0 && new Date(point.timestamp).getTime() - new Date(route[index - 1].timestamp).getTime() > 600_000);

    return {
      groupId,
      distanceKm: routeDistance(route),
      incompleteCoverage,
      selectedTripId: selected.id,
      vehicle: {
        id: ref.vehicle_id, name: ref.vehicle_name, licensePlate: ref.license_plate, displayId: ref.vehicle_display_id,
        make: ref.make, model: ref.model, year: ref.year, type: ref.type,
      },
      trips,
      route,
      eta,
    };
  }

  async getCrewTripEta(user: User, tripId: string) {
    const trip = await this.tripRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Crew trip not found');
    await this.getAirline(user, trip.airlineId);
    const eta = trip.status === 'in_progress'
      ? await this.estimateArrival(trip.vehicleId, trip.plannedLat, trip.plannedLng).catch(() => null)
      : null;
    return { eta, status: trip.status };
  }

  async deleteCrewTrips(user: User, tripIds: string[]) {
    await this.tripRepo.delete(tripIds);
    return { success: true, deleted: tripIds.length };
  }

  // ─── Airport Settings ────────────────────────────────────────────────────────

  async listAirports(user: User) {
    const orgId = this.orgId(user);
    const where = orgId ? { organizationId: orgId } : {};
    return this.airportRepo.find({ where, order: { displayId: 'ASC' } });
  }

  async createAirport(user: User, body: { name: string; iataCode?: string; cityId?: string; lat: number; lng: number }) {
    const orgId = this.isInternal(user) ? null : user.organizationId;
    const airport = this.airportRepo.create({ name: body.name, lat: body.lat, lng: body.lng, iataCode: body.iataCode ?? null, cityId: body.cityId ?? null, organizationId: orgId } as any);
    return this.airportRepo.save(airport);
  }

  async updateAirport(user: User, id: string, body: { name?: string; iataCode?: string; cityId?: string; lat?: number; lng?: number }) {
    const airport = await this.airportRepo.findOneBy({ id });
    if (!airport) throw new NotFoundException('Airport not found');
    Object.assign(airport, body);
    return this.airportRepo.save(airport);
  }

  async deleteAirport(user: User, id: string) {
    await this.airportRepo.delete(id);
    return { success: true };
  }
}
