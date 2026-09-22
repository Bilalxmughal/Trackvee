import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index,
} from 'typeorm';

export type DriverEventType = 'harsh_brake' | 'rapid_accel' | 'sharp_turn' | 'overspeed';
export type DriverEventSeverity = 'low' | 'medium' | 'high';

const EVENT_TYPES = ['harsh_brake', 'rapid_accel', 'sharp_turn', 'overspeed'] as const;
const SEVERITIES  = ['low', 'medium', 'high'] as const;

@Entity('driver_events')
@Index(['vehicleId', 'timestamp'])
@Index(['organizationId', 'timestamp'])
export class DriverEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ type: 'varchar' })
  imei: string;

  @Column({ type: 'enum', enum: EVENT_TYPES })
  type: DriverEventType;

  @Column({ type: 'enum', enum: SEVERITIES, default: 'medium' })
  severity: DriverEventSeverity;

  @Column({ name: 'speed_kmh', type: 'float', default: 0 })
  speedKmh: number;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
