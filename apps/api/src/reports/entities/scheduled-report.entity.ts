import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('scheduled_reports')
export class ScheduledReport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'user_id', type: 'uuid' }) userId: string;
  @Column({ name: 'org_id', type: 'uuid', nullable: true }) orgId: string | null;
  @Column({ type: 'varchar', length: 120 }) title: string;
  @Column({ name: 'report_type', type: 'varchar', length: 40 }) reportType: string;
  @Column({ type: 'jsonb', default: {} }) params: Record<string, unknown>;
  @Column({ name: 'recipient_emails', type: 'text', array: true, default: () => "'{}'" }) recipientEmails: string[];
  @Column({ name: 'period_key', type: 'varchar', length: 24 }) period: string;
  @Column({ name: 'time_pkt', type: 'varchar', length: 5 }) timePkt: string;
  @Column({ name: 'report_from_time', type: 'varchar', length: 5, nullable: true }) reportFromTime: string | null;
  @Column({ name: 'report_to_time', type: 'varchar', length: 5, nullable: true }) reportToTime: string | null;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ name: 'next_run_at', type: 'timestamptz' }) nextRunAt: Date;
  @Column({ name: 'last_attempt_at', type: 'timestamptz', nullable: true }) lastAttemptAt: Date | null;
  @Column({ name: 'last_sent_at', type: 'timestamptz', nullable: true }) lastSentAt: Date | null;
  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true }) lastError: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
