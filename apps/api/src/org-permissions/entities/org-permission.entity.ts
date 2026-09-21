import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('org_user_permissions')
export class OrgPermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'org_id', type: 'uuid' })
  orgId: string;

  @Column({ name: 'vehicles_view',   default: true  }) vehiclesView:   boolean;
  @Column({ name: 'vehicles_add',    default: false }) vehiclesAdd:    boolean;
  @Column({ name: 'vehicles_edit',   default: false }) vehiclesEdit:   boolean;
  @Column({ name: 'vehicles_delete', default: false }) vehiclesDelete: boolean;

  @Column({ name: 'alerts_view',   default: true  }) alertsView:   boolean;
  @Column({ name: 'alerts_add',    default: true  }) alertsAdd:    boolean;
  @Column({ name: 'alerts_edit',   default: true  }) alertsEdit:   boolean;
  @Column({ name: 'alerts_delete', default: false }) alertsDelete: boolean;

  @Column({ name: 'geofences_view',   default: true  }) geofencesView:   boolean;
  @Column({ name: 'geofences_add',    default: true  }) geofencesAdd:    boolean;
  @Column({ name: 'geofences_edit',   default: true  }) geofencesEdit:   boolean;
  @Column({ name: 'geofences_delete', default: false }) geofencesDelete: boolean;

  @Column({ name: 'pois_view',   default: true  }) poisView:   boolean;
  @Column({ name: 'pois_add',    default: true  }) poisAdd:    boolean;
  @Column({ name: 'pois_edit',   default: true  }) poisEdit:   boolean;
  @Column({ name: 'pois_delete', default: false }) poisDelete: boolean;

  @Column({ name: 'vehicle_ids', type: 'text', array: true, nullable: true, default: () => 'NULL' })
  vehicleIds: string[] | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
