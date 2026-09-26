import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('saved_reports')
export class SavedReport {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'varchar', length: 50 })  type: string;
  @Column({ type: 'jsonb', default: {} })   params: Record<string, unknown>;

  @Column({ name: 'org_id',    type: 'uuid', nullable: true }) orgId:    string | null;
  @Column({ name: 'user_id',   type: 'uuid', nullable: true }) userId:   string | null;
  @Column({ name: 'user_name', type: 'varchar', length: 255, nullable: true }) userName: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
