import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('role_portal_permissions')
export class RolePortalPermission {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  role: string;

  @Column({ type: 'jsonb', default: {} })
  permissions: Record<string, string[]>;
}
