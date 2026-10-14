import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity.js';
import { User } from '../../users/entities/user.entity.js';

export type InvoiceType = 'monthly_subscription' | 'device_sale' | 'installation' | 'removal' | 'transfer' | 'reactivation' | 'activity' | 'manual';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id' })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'org_id' })
  org: Organization;

  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId: string | null;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId: string | null;

  @Column({ name: 'activity_type_id', type: 'uuid', nullable: true })
  activityTypeId: string | null;

  @Column({ name: 'invoice_no', type: 'varchar', length: 30, unique: true })
  invoiceNo: string;

  @Column({ type: 'varchar', length: 30 })
  type: InvoiceType;

  @Column({ name: 'period_from', type: 'date', nullable: true })
  periodFrom: string | null;

  @Column({ name: 'period_to', type: 'date', nullable: true })
  periodTo: string | null;

  @Column({ name: 'base_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  baseAmount: number;

  @Column({ name: 'tax_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: InvoiceStatus;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
