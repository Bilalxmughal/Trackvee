import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('alert_logs')
export class AlertLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'alert_id', type: 'uuid' })
  alertId: string;

  @Column({ type: 'varchar', length: 20 })
  imei: string;

  @CreateDateColumn({ name: 'triggered_at' })
  triggeredAt: Date;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;
}
