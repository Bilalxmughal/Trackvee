import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity.js';
import { User } from '../../users/entities/user.entity.js';

export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'online' | 'other';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id' })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'org_id' })
  org: Organization;

  @Column({ name: 'payment_no', type: 'varchar', length: 30, unique: true })
  paymentNo: string;

  @Column({ name: 'payment_date', type: 'date' })
  paymentDate: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 20, default: 'cash' })
  method: PaymentMethod;

  @Column({ name: 'reference_no', type: 'varchar', length: 100, nullable: true })
  referenceNo: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
