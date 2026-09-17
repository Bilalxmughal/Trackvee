import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

@Entity('telemetry')
@Index(['imei', 'timestamp'])
export class Telemetry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id', nullable: true })
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

  @Column({ type: 'jsonb', nullable: true })
  raw: object | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
