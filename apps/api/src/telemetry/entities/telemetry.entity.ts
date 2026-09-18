import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('telemetry')
@Index(['imei', 'timestamp'])
export class Telemetry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId: string | null;

  @Index()
  @Column()
  imei: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ name: 'speed_kmh', type: 'float', default: 0 })
  speedKmh: number;

  @Column({ type: 'int', default: 0 })
  heading: number;

  @Column({ type: 'int', default: 0 })
  satellites: number;

  @Column({ name: 'gps_valid', default: false })
  gpsValid: boolean;

  @Column({ type: 'boolean', nullable: true })
  ignition: boolean | null;

  @Column({ name: 'external_power', type: 'boolean', nullable: true })
  externalPower: boolean | null;

  @Column({ name: 'immobilizer', type: 'boolean', nullable: true })
  immobilizer: boolean | null;

  @Column({ name: 'voltage_level', type: 'int', nullable: true })
  voltageLevel: number | null;

  @Column({ name: 'gsm_signal', type: 'int', nullable: true })
  gsmSignal: number | null;

  @Column({ type: 'float', nullable: true })
  altitude: number | null;

  @Column({ type: 'jsonb', nullable: true })
  raw: object | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
