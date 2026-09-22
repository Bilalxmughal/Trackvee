import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('driver_scores')
@Index(['vehicleId', 'date'], { unique: true })
@Index(['organizationId', 'date'])
export class DriverScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'float', default: 100 })
  score: number;

  @Column({ name: 'harsh_brake_count', type: 'int', default: 0 })
  harshBrakeCount: number;

  @Column({ name: 'rapid_accel_count', type: 'int', default: 0 })
  rapidAccelCount: number;

  @Column({ name: 'sharp_turn_count', type: 'int', default: 0 })
  sharpTurnCount: number;

  @Column({ name: 'overspeed_count', type: 'int', default: 0 })
  overspeedCount: number;

  @Column({ name: 'distance_km', type: 'float', default: 0 })
  distanceKm: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
