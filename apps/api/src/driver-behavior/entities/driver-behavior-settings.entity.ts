import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';

@Entity('driver_behavior_settings')
export class DriverBehaviorSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ name: 'overspeed_threshold', type: 'float', default: 100 })
  overspeedThreshold: number;

  @Column({ name: 'harsh_brake_deceleration', type: 'float', default: 8 })
  harshBrakeDeceleration: number;

  @Column({ name: 'rapid_accel_threshold', type: 'float', default: 6 })
  rapidAccelThreshold: number;

  @Column({ name: 'sharp_turn_angle', type: 'float', default: 45 })
  sharpTurnAngle: number;

  @Column({ name: 'sharp_turn_min_speed', type: 'float', default: 20 })
  sharpTurnMinSpeed: number;

  @Column({ name: 'deduction_harsh_brake', type: 'float', default: 5 })
  deductionHarshBrake: number;

  @Column({ name: 'deduction_rapid_accel', type: 'float', default: 3 })
  deductionRapidAccel: number;

  @Column({ name: 'deduction_sharp_turn', type: 'float', default: 3 })
  deductionSharpTurn: number;

  @Column({ name: 'deduction_overspeed', type: 'float', default: 5 })
  deductionOverspeed: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
