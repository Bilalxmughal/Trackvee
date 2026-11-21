import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('airline_vehicles')
export class AirlineVehicle {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'airline_id', type: 'uuid' }) airlineId: string;
  @Column({ name: 'vehicle_id', type: 'uuid' }) vehicleId: string;
  @Column({ name: 'pin_hash', type: 'varchar', length: 60, nullable: true }) pinHash: string | null;
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true }) lastLoginAt: Date | null;
  @Column({ name: 'session_revoked_at', type: 'timestamptz', nullable: true }) sessionRevokedAt: Date | null;
  @Column({ name: 'active_session_id', type: 'uuid', nullable: true }) activeSessionId: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
