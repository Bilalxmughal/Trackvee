import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type SpeedZoneType = 'circle' | 'polygon';
export interface SZCircleCoords { center: [number, number]; radius: number; }
export interface SZPolygonCoords { points: [number, number][]; }

@Entity('speed_zones')
export class SpeedZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId: string | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  type: SpeedZoneType;

  @Column({ type: 'jsonb' })
  coordinates: SZCircleCoords | SZPolygonCoords;

  @Column({ name: 'speed_limit', type: 'int', default: 60 })
  speedLimit: number;

  @Column({ type: 'varchar', length: 7, default: '#f59e0b' })
  color: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
