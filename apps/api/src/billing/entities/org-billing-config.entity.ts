import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../../organizations/entities/organization.entity.js';

@Entity('org_billing_config')
export class OrgBillingConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id' })
  orgId: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  org: Organization;

  @Column({ name: 'billing_cycle', type: 'varchar', length: 20, default: 'monthly' })
  billingCycle: 'monthly' | 'annual';

  @Column({ name: 'device_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  devicePrice: number | null;

  @Column({ name: 'installation_charge', type: 'numeric', precision: 12, scale: 2, nullable: true })
  installationCharge: number | null;

  @Column({ name: 'removal_charge', type: 'numeric', precision: 12, scale: 2, nullable: true })
  removalCharge: number | null;

  @Column({ name: 'transfer_charge', type: 'numeric', precision: 12, scale: 2, nullable: true })
  transferCharge: number | null;

  @Column({ name: 'reactivation_charge', type: 'numeric', precision: 12, scale: 2, nullable: true })
  reactivationCharge: number | null;

  @Column({ name: 'monthly_fixed_charge', type: 'numeric', precision: 12, scale: 2, nullable: true })
  monthlyFixedCharge: number | null;

  @Column({ name: 'tax_percent', type: 'numeric', precision: 5, scale: 2, nullable: true })
  taxPercent: number | null;

  @Column({ name: 'threshold_enabled', type: 'boolean', nullable: true })
  thresholdEnabled: boolean | null;

  @Column({ name: 'threshold_days', type: 'int', nullable: true })
  thresholdDays: number | null;

  @Column({ name: 'activity_overrides', type: 'jsonb', nullable: true })
  activityOverrides: Record<string, number> | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
