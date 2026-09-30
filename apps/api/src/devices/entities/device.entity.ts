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

  @Column({ name: 'display_id', type: 'int', unique: true, default: () => "nextval('global_display_id_seq')" })
  displayId: number;

  @Index({ unique: true })
  @Column()
  imei: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ name: 'sim_number', type: 'varchar', nullable: true })
  simNumber: string | null;

  @Column({ type: 'enum', enum: DEVICE_STATUSES, default: 'offline' })
  status: DeviceStatus;

  @Column({ name: 'inventory_status', type: 'varchar', length: 16, default: 'in_stock' })
  inventoryStatus: 'in_stock' | 'assigned' | 'maintenance' | 'retired';

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId: string | null;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle | null;

  @Column({ name: 'city_id', type: 'uuid', nullable: true })
  cityId: string | null;

  @Column({ name: 'last_seen_at', type: 'timestamptz', nullable: true })
  lastSeenAt: Date | null;

  @Column({ name: 'last_ignition', type: 'boolean', nullable: true })
  lastIgnition: boolean | null;

  @Column({ name: 'last_external_power', type: 'boolean', nullable: true })
  lastExternalPower: boolean | null;

  @Column({ name: 'last_immobilizer', type: 'boolean', nullable: true })
  lastImmobilizer: boolean | null;

  @Column({ name: 'last_voltage_level', type: 'int', nullable: true })
  lastVoltageLevel: number | null;

  @Column({ name: 'last_gsm_signal', type: 'int', nullable: true })
  lastGsmSignal: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
