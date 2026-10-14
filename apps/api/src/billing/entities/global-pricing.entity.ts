import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

@Entity('global_pricing')
export class GlobalPricing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_price', type: 'numeric', precision: 12, scale: 2, default: 0 })
  devicePrice: number;

  @Column({ name: 'installation_charge', type: 'numeric', precision: 12, scale: 2, default: 0 })
  installationCharge: number;

  @Column({ name: 'removal_charge', type: 'numeric', precision: 12, scale: 2, default: 0 })
  removalCharge: number;

  @Column({ name: 'transfer_charge', type: 'numeric', precision: 12, scale: 2, default: 0 })
  transferCharge: number;

  @Column({ name: 'reactivation_charge', type: 'numeric', precision: 12, scale: 2, default: 0 })
  reactivationCharge: number;

  @Column({ name: 'monthly_fixed_charge', type: 'numeric', precision: 12, scale: 2, default: 0 })
  monthlyFixedCharge: number;

  @Column({ name: 'tax_percent', type: 'numeric', precision: 5, scale: 2, default: 0 })
  taxPercent: number;

  @Column({ name: 'threshold_enabled', default: true })
  thresholdEnabled: boolean;

  @Column({ name: 'threshold_days', default: 5 })
  thresholdDays: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedBy?: User;
}
