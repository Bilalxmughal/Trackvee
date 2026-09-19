import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type GeofenceType = 'circle' | 'polygon';

export interface CircleCoords { center: [number, number]; radius: number; }
export interface PolygonCoords { points: [number, number][]; }

@Entity('geofences')
export class Geofence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId: string | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: GeofenceType;

  @Column({ type: 'jsonb' })
  coordinates: CircleCoords | PolygonCoords;

  @Column({ type: 'varchar', length: 7, default: '#dc2626' })
  color: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
