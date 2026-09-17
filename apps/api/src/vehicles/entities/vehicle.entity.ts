import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import type { VehicleType } from '@yotrack/types';
import { Organization } from '../../organizations/entities/organization.entity.js';

const VEHICLE_TYPES = ['car', 'motorcycle', 'truck', 'van', 'bus', 'other'] as const;

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'license_plate', type: 'varchar', nullable: true })
  licensePlate: string | null;

  @Column({ type: 'varchar', nullable: true })
  make: string | null;

  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ type: 'int', nullable: true })
  year: number | null;

  @Column({ type: 'enum', enum: VEHICLE_TYPES, default: 'car' })
  type: VehicleType;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
