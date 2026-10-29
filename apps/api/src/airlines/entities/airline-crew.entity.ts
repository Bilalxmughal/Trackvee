import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('airline_crews')
export class AirlineCrew {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'display_id', type: 'int', unique: true, default: () => "nextval('crew_display_id_seq')" })
  displayId: number;

  @Column({ name: 'airline_id', type: 'uuid' }) airlineId: string;

  @Column({ type: 'varchar', length: 100 }) name: string;

  @Column({ type: 'varchar', length: 100, nullable: true }) designation: string | null;

  @Column({ name: 'stop_name', type: 'varchar', length: 200, nullable: true }) stopName: string | null;

  @Column({ name: 'stop_lat', type: 'double precision', nullable: true }) stopLat: number | null;

  @Column({ name: 'stop_lng', type: 'double precision', nullable: true }) stopLng: number | null;

  @Index({ unique: true })
  @Column({ name: 'nfc_card_uid', type: 'varchar', length: 100, nullable: true }) nfcCardUid: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true }) phone: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
