import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type ScanLocationSource = 'scanner_gps' | 'vehicle_tracker' | 'unavailable';

@Entity('crew_trips')
export class CrewTrip {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'display_id', type: 'int', unique: true, default: () => "nextval('global_display_id_seq')" }) displayId: number;
  @Column({ name: 'crew_id', type: 'uuid' }) crewId: string;
  @Column({ name: 'vehicle_id', type: 'uuid' }) vehicleId: string;
  @Column({ name: 'airline_id', type: 'uuid' }) airlineId: string;
  @Column({ name: 'flight_number', type: 'varchar', length: 20, nullable: true }) flightNumber: string | null;
  @Column({ type: 'varchar', length: 20, default: 'in_progress' }) status: string;

  @Column({ name: 'checkin_at', type: 'timestamptz', nullable: true }) checkinAt: Date | null;
  @Column({ name: 'checkin_lat', type: 'double precision', nullable: true }) checkinLat: number | null;
  @Column({ name: 'checkin_lng', type: 'double precision', nullable: true }) checkinLng: number | null;
  @Column({ name: 'checkin_stop', type: 'varchar', length: 200, nullable: true }) checkinStop: string | null;
  @Column({ name: 'checkin_location_source', type: 'varchar', length: 20, nullable: true })
  checkinLocationSource: ScanLocationSource | null;
  @Column({ name: 'checkin_odometer_km', type: 'numeric', precision: 10, scale: 2, nullable: true }) checkinOdometerKm: string | null;

  @Column({ name: 'checkout_at', type: 'timestamptz', nullable: true }) checkoutAt: Date | null;
  @Column({ name: 'checkout_lat', type: 'double precision', nullable: true }) checkoutLat: number | null;
  @Column({ name: 'checkout_lng', type: 'double precision', nullable: true }) checkoutLng: number | null;
  @Column({ name: 'checkout_stop', type: 'varchar', length: 200, nullable: true }) checkoutStop: string | null;
  @Column({ name: 'checkout_location_source', type: 'varchar', length: 20, nullable: true })
  checkoutLocationSource: ScanLocationSource | null;
  @Column({ name: 'checkout_odometer_km', type: 'numeric', precision: 10, scale: 2, nullable: true }) checkoutOdometerKm: string | null;

  @Column({ name: 'km_travelled', type: 'numeric', precision: 10, scale: 2, nullable: true }) kmTravelled: string | null;

  @Column({ name: 'flight_date', type: 'date', nullable: true }) flightDate: string | null;
  @Column({ name: 'passenger_count', type: 'smallint', nullable: true }) passengerCount: number | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;

  @Column({ name: 'planned_stop', type: 'varchar', length: 200, nullable: true }) plannedStop: string | null;
  @Column({ name: 'planned_lat', type: 'double precision', nullable: true }) plannedLat: number | null;
  @Column({ name: 'planned_lng', type: 'double precision', nullable: true }) plannedLng: number | null;
  @Column({ name: 'initial_eta_at', type: 'timestamptz', nullable: true }) initialEtaAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
