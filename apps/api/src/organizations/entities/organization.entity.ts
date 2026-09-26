import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, Index,
} from 'typeorm';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'display_id', type: 'int', unique: true, default: () => "nextval('global_display_id_seq')" })
  displayId: number;

  @Column()
  name: string;

  @Column({ name: 'company_name', type: 'varchar', nullable: true })
  companyName: string | null;

  @Column({ name: 'poc_name', type: 'varchar', nullable: true })
  pocName: string | null;

  @Column({ name: 'contact_no', type: 'varchar', nullable: true })
  contactNo: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Index({ unique: true })
  @Column()
  slug: string;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @Column({ name: 'city_id', type: 'uuid', nullable: true })
  cityId: string | null;

  @Column({ type: 'varchar', length: 10, default: 'b2b' })
  type: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'tracking_expires_at', type: 'timestamptz', nullable: true })
  trackingExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
