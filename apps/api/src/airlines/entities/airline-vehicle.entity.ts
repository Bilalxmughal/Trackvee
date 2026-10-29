import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('airline_vehicles')
export class AirlineVehicle {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'airline_id', type: 'uuid' }) airlineId: string;
  @Column({ name: 'vehicle_id', type: 'uuid' }) vehicleId: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}
