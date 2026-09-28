import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('mobile_push_tokens')
@Index('uq_mobile_push_tokens_token', ['token'], { unique: true })
@Index('ix_mobile_push_tokens_user_org', ['userId', 'organizationId'])
export class MobilePushToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @Column({ type: 'text' })
  token: string;

  @Column({ type: 'varchar', length: 10 })
  platform: 'ios' | 'android';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
