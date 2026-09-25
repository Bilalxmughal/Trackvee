import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'command' | 'export';
export type AuditStatus = 'success' | 'failed';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;

  @CreateDateColumn({ name: 'timestamp' }) timestamp: Date;

  @Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;
  @Column({ name: 'user_email', type: 'varchar', length: 255, nullable: true }) userEmail: string | null;
  @Column({ name: 'user_name', type: 'varchar', length: 255, nullable: true }) userName: string | null;
  @Column({ name: 'user_role', type: 'varchar', length: 50, nullable: true }) userRole: string | null;

  @Column({ name: 'org_id', type: 'uuid', nullable: true }) orgId: string | null;
  @Column({ name: 'org_name', type: 'varchar', length: 255, nullable: true }) orgName: string | null;

  @Column({ type: 'varchar', length: 30 }) action: AuditAction;
  @Column({ name: 'entity_type', type: 'varchar', length: 50 }) entityType: string;
  @Column({ name: 'entity_id', type: 'varchar', length: 255, nullable: true }) entityId: string | null;
  @Column({ name: 'entity_name', type: 'varchar', length: 255, nullable: true }) entityName: string | null;

  @Column({ type: 'jsonb', nullable: true }) details: Record<string, unknown> | null;
  @Column({ type: 'varchar', length: 45, nullable: true }) ip: string | null;
  @Column({ type: 'varchar', length: 20, default: 'success' }) status: AuditStatus;
}
