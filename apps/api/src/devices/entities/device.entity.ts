import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import type { DeviceStatus } from '@yotrack/types';
import { Vehicle } from '../../vehicles/entities/vehicle.entity.js';

const DEVICE_STATUSES = ['active', 'inactive', 'unassigned', 'offline'] as const;

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  imei: string;

  @Column({ nullable: true })
  name: string | null;

  @Column({ name: 'sim_number', nullable: true })
  simNumber: string | null;

  @Column({ type: 'enum', enum: DEVICE_STATUSES, default: 'offline' })
  status: DeviceStatus;

  @Column({ name: 'vehicle_id', nullable: true })
  vehicleId: string | null;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle | null;

  @Column({ name: 'last_seen_at', nullable: true })
  lastSeenAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
