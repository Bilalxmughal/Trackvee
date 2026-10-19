import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('maintenance_records')
@Index(['organizationId', 'vehicleId', 'serviceDate'])
export class MaintenanceRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid', nullable: true }) organizationId: string | null;
  @Column({ name: 'vehicle_id', type: 'uuid' }) vehicleId: string;
  @Column({ name: 'service_type', type: 'varchar', length: 80 }) serviceType: string;
  @Column({ name: 'service_date', type: 'date' }) serviceDate: string;
  @Column({ name: 'odometer_km', type: 'numeric', precision: 12, scale: 1, nullable: true }) odometerKm: string | null;
  @Column({ name: 'provider', type: 'varchar', length: 120, nullable: true }) provider: string | null;
  @Column({ name: 'cost', type: 'numeric', precision: 12, scale: 2, nullable: true }) cost: string | null;
  @Column({ name: 'notes', type: 'text', nullable: true }) notes: string | null;
  @Column({ name: 'next_due_date', type: 'date', nullable: true }) nextDueDate: string | null;
  @Column({ name: 'next_due_odometer_km', type: 'numeric', precision: 12, scale: 1, nullable: true }) nextDueOdometerKm: string | null;
  @Column({ name: 'reminder_days_before', type: 'int', default: 30 }) reminderDaysBefore: number;
  @Column({ name: 'reminder_km_before', type: 'int', default: 500 }) reminderKmBefore: number;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
