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

  @Column({ name: 'supports_custom_sounds', type: 'boolean', default: false })
  supportsCustomSounds: boolean;

  @Column({ name: 'supports_dynamic_sounds', type: 'boolean', default: false })
  supportsDynamicSounds: boolean;

  @Column({ name: 'dynamic_sound_ids', type: 'uuid', array: true, default: () => "'{}'" })
  dynamicSoundIds: string[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
