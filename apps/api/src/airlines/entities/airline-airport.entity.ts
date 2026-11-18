import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('airline_airports')
export class AirlineAirport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'display_id', type: 'int', unique: true, default: () => "nextval('global_display_id_seq')" }) displayId: number;
  @Column({ name: 'organization_id', type: 'uuid', nullable: true }) organizationId: string | null;
  @Column({ type: 'varchar', length: 200 }) name: string;
  @Column({ name: 'iata_code', type: 'varchar', length: 10, nullable: true }) iataCode: string | null;
  @Column({ name: 'city_id', type: 'uuid', nullable: true }) cityId: string | null;
  @Column({ type: 'double precision' }) lat: number;
  @Column({ type: 'double precision' }) lng: number;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
