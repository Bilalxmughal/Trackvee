import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Airline } from './entities/airline.entity.js';
import { AirlineCrew } from './entities/airline-crew.entity.js';
import { AirlineVehicle } from './entities/airline-vehicle.entity.js';
import { CrewTrip } from './entities/crew-trip.entity.js';
import { User } from '../users/entities/user.entity.js';

const INTERNAL_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Trackvee/1.0' } });
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
    private dataSource: DataSource,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private orgId(user: User): string | null {
    return INTERNAL_ROLES.includes(user.role) ? null : user.organizationId;
  }

  private isInternal(user: User): boolean {
    return INTERNAL_ROLES.includes(user.role);
  }

  // ─── Airlines CRUD ───────────────────────────────────────────────────────────

  async listAirlines(user: User, organizationId?: string) {
    const qb = this.airlineRepo.createQueryBuilder('a');
    if (!this.isInternal(user)) {
      qb.where('a.organization_id = :orgId', { orgId: user.organizationId });
    } else if (organizationId) {
      qb.where('a.organization_id = :orgId', { orgId: organizationId });
    }
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
    if (!this.isInternal(user) && a.organizationId !== user.organizationId) throw new NotFoundException();
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
    const rows = await this.avRepo.find({ where: { airlineId } });

    if (!rows.length) return [];

    const vehicleIds = rows.map(r => r.vehicleId);
    const vehicles = await this.dataSource.query(
      `SELECT v.id, v.display_id, v.name, v.license_plate, v.type, v.lifecycle_status FROM vehicles v WHERE v.id = ANY($1)`,
      [vehicleIds],
    );
    return vehicles;
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

  async getAirlineByVehicle(vehicleId: string) {
    const row = await this.avRepo.findOne({ where: { vehicleId } });
    if (!row) return null;
    const airline = await this.airlineRepo.findOne({ where: { id: row.airlineId } });
    return airline ? { id: airline.id, name: airline.name, iataCode: airline.iataCode } : null;
  }

  // ─── Trips: Check-in / Check-out ─────────────────────────────────────────────

  async checkin(body: { nfcUid: string; vehicleId: string; flightNumber?: string; lat: number; lng: number }) {
    const crew = await this.crewRepo.findOne({ where: { nfcCardUid: body.nfcUid } });
    if (!crew) throw new NotFoundException('NFC card not registered');

    const open = await this.tripRepo.findOne({ where: { crewId: crew.id, status: 'in_progress' } });
    if (open) throw new BadRequestException(`${crew.name} already checked in (trip ${open.id})`);

    const airline = await this.airlineRepo.findOne({ where: { id: crew.airlineId } });
    const stopName = await reverseGeocode(body.lat, body.lng);

    // Get vehicle odometer from vehicles table
    const [veh] = await this.dataSource.query(
      `SELECT odometer_km FROM vehicles WHERE id = $1`, [body.vehicleId],
    );

    const trip = this.tripRepo.create({
      crewId: crew.id,
      vehicleId: body.vehicleId,
      airlineId: crew.airlineId,
      flightNumber: body.flightNumber ?? null,
      status: 'in_progress',
      checkinAt: new Date(),
      checkinLat: body.lat,
      checkinLng: body.lng,
      checkinStop: stopName,
      checkinOdometerKm: veh?.odometer_km ?? null,
    });
    const saved = await this.tripRepo.save(trip);

    return {
      tripId: saved.id,
      crew: { id: crew.id, displayId: crew.displayId, name: crew.name, designation: crew.designation },
      airline: airline ? { id: airline.id, name: airline.name } : null,
      checkinAt: saved.checkinAt,
      checkinStop: stopName,
    };
  }

  async checkout(body: { nfcUid: string; lat: number; lng: number }) {
    const crew = await this.crewRepo.findOne({ where: { nfcCardUid: body.nfcUid } });
    if (!crew) throw new NotFoundException('NFC card not registered');

    const trip = await this.tripRepo.findOne({ where: { crewId: crew.id, status: 'in_progress' } });
    if (!trip) throw new BadRequestException(`${crew.name} is not checked in`);

    const stopName = await reverseGeocode(body.lat, body.lng);

    // Get vehicle current odometer
    const [veh] = await this.dataSource.query(
      `SELECT odometer_km FROM vehicles WHERE id = $1`, [trip.vehicleId],
    );
    const checkoutOdometer = veh?.odometer_km ?? null;

    // Calculate KM from telemetry GPS path between checkin and now
    let kmTravelled: number | null = null;
    try {
      const [device] = await this.dataSource.query(
        `SELECT d.imei FROM devices d WHERE d.vehicle_id = $1 AND d.status != 'unassigned' LIMIT 1`,
        [trip.vehicleId],
      );
      if (device && trip.checkinAt) {
        const points = await this.dataSource.query(
          `SELECT latitude, longitude FROM telemetry
           WHERE imei = $1 AND timestamp BETWEEN $2 AND NOW()
           AND gps_valid = true
           ORDER BY timestamp ASC`,
          [device.imei, trip.checkinAt],
        );
        if (points.length >= 2) {
          let km = 0;
          for (let i = 1; i < points.length; i++) {
            km += haversineKm(points[i-1].latitude, points[i-1].longitude, points[i].latitude, points[i].longitude);
          }
          kmTravelled = Math.round(km * 100) / 100;
        } else if (trip.checkinLat && trip.checkinLng) {
          kmTravelled = Math.round(haversineKm(trip.checkinLat, trip.checkinLng, body.lat, body.lng) * 100) / 100;
        }
      }
    } catch {
      // KM calculation failed — leave as null
    }

    trip.checkoutAt = new Date();
    trip.checkoutLat = body.lat;
    trip.checkoutLng = body.lng;
    trip.checkoutStop = stopName;
    trip.checkoutOdometerKm = checkoutOdometer;
    trip.kmTravelled = kmTravelled !== null ? String(kmTravelled) : null;
    trip.status = 'completed';

    const saved = await this.tripRepo.save(trip);
    return {
      tripId: saved.id,
      crew: { id: crew.id, displayId: crew.displayId, name: crew.name },
      checkoutAt: saved.checkoutAt,
      checkoutStop: stopName,
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
        't.checkin_at', 't.checkin_stop', 't.checkin_lat', 't.checkin_lng',
        't.checkout_at', 't.checkout_stop', 't.checkout_lat', 't.checkout_lng',
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

  async getActiveTripByNfc(nfcUid: string) {
    const crew = await this.crewRepo.findOne({ where: { nfcCardUid: nfcUid } });
    if (!crew) return null;
    const trip = await this.tripRepo.findOne({ where: { crewId: crew.id, status: 'in_progress' } });
    return trip ? { trip, crew } : null;
  }
}
