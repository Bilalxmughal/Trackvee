import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('notification_sounds')
export class NotificationSound {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ name: 'file_name', type: 'varchar', length: 120, unique: true })
  fileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 32, default: 'audio/wav' })
  mimeType: string;

  @Column({ name: 'duration_ms', type: 'integer' })
  durationMs: number;

  @Column({ name: 'file_data', type: 'bytea', select: false })
  fileData: Buffer;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
