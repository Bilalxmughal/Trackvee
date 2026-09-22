import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('vehicle_group_memberships')
export class VehicleGroupMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId: string;

  @Index()
  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;
}
