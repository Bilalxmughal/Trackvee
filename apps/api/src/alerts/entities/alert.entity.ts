import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type AlertType =
  | 'over_speed' | 'idle' | 'ignition_on' | 'ignition_off'
  | 'power_cut' | 'low_battery' | 'no_gps' | 'offline'
  | 'tow' | 'over_parking' | 'geofence' | 'poi' | 'low_score';

export interface AlertConfig {
  speedLimit?: number;       // over_speed
  minutes?: number;          // idle, no_gps, offline, over_parking
  level?: number;            // low_battery (1-5)
  geofenceId?: string;       // geofence
  geofenceEvent?: 'enter' | 'exit' | 'both'; // geofence
  poiId?: string;            // poi
  poiEvent?: 'enter' | 'exit' | 'both'; // poi
  scoreThreshold?: number;   // low_score
}

export interface AlertSchedule {
  from?: string;       // ISO date string
  to?: string;
  days?: string[];     // ['mon','tue','wed','thu','fri','sat','sun']
  timeFrom?: string;   // 'HH:MM'
  timeTo?: string;
}

export interface AlertNotifications {
  appPush?: boolean;
  webPush?: boolean;
  webSound?: boolean;
  email?: boolean;
}

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'org_id', type: 'uuid', nullable: true })
  orgId: string | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'varchar', length: 50 })
  type: AlertType;

  @Column({ type: 'jsonb', default: {} })
  config: AlertConfig;

  @Column({ name: 'vehicle_imeis', type: 'text', array: true, default: [] })
  vehicleImeis: string[];

  @Column({ type: 'jsonb', nullable: true })
  schedule: AlertSchedule | null;

  @Column({ type: 'jsonb', default: {} })
  notifications: AlertNotifications;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
