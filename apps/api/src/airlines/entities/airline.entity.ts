import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('airlines')
export class Airline {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'display_id', type: 'int', unique: true, default: () => "nextval('global_display_id_seq')" })
  displayId: number;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true }) organizationId: string | null;
  @Column({ name: 'city_id', type: 'uuid', nullable: true }) cityId: string | null;
  @Column({ type: 'varchar', length: 100 }) name: string;
  @Column({ name: 'iata_code', type: 'varchar', length: 10, nullable: true }) iataCode: string | null;
  @Column({ name: 'contact_person', type: 'varchar', length: 100, nullable: true }) contactPerson: string | null;
  @Column({ name: 'contact_phone', type: 'varchar', length: 30, nullable: true }) contactPhone: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
