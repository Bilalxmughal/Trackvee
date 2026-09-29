import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrgPermission } from './entities/org-permission.entity.js';

export interface OrgPermDto {
  vehiclesView?: boolean; vehiclesAdd?: boolean; vehiclesEdit?: boolean; vehiclesDelete?: boolean;
  alertsView?: boolean;   alertsAdd?: boolean;   alertsEdit?: boolean;   alertsDelete?: boolean;
  geofencesView?: boolean; geofencesAdd?: boolean; geofencesEdit?: boolean; geofencesDelete?: boolean;
  poisView?: boolean; poisAdd?: boolean; poisEdit?: boolean; poisDelete?: boolean;
  driverBehaviorView?: boolean | null; driverBehaviorEdit?: boolean | null;
  reportsView?: boolean | null;
  usersView?: boolean | null; usersAdd?: boolean | null; usersEdit?: boolean | null; usersDelete?: boolean | null;
  maintenanceView?: boolean | null; maintenanceAdd?: boolean | null; maintenanceEdit?: boolean | null; maintenanceDelete?: boolean | null;
  vehicleIds?: string[] | null;
}

@Injectable()
export class OrgPermissionsService {
  constructor(
    @InjectRepository(OrgPermission)
    private repo: Repository<OrgPermission>,
  ) {}

  async findByUser(userId: string): Promise<OrgPermission | null> {
    return this.repo.findOne({ where: { userId } });
  }

  async upsert(userId: string, orgId: string, dto: OrgPermDto): Promise<OrgPermission> {
    const existing = await this.repo.findOne({ where: { userId, orgId } });
    if (existing) {
      Object.assign(existing, dto);
      return this.repo.save(existing);
    }
    const perm = this.repo.create({ userId, orgId, ...dto });
    return this.repo.save(perm);
  }

  async remove(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  // Returns default full-access permissions (for org_owner / org_admin)
  static fullAccess(userId: string, orgId: string): OrgPermission {
    return {
      id: '', userId, orgId,
      vehiclesView: true, vehiclesAdd: true, vehiclesEdit: true, vehiclesDelete: true,
      alertsView: true, alertsAdd: true, alertsEdit: true, alertsDelete: true,
      geofencesView: true, geofencesAdd: true, geofencesEdit: true, geofencesDelete: true,
      poisView: true, poisAdd: true, poisEdit: true, poisDelete: true,
      driverBehaviorView: null, driverBehaviorEdit: null, reportsView: null,
      usersView: null, usersAdd: null, usersEdit: null, usersDelete: null,
      maintenanceView: null, maintenanceAdd: null, maintenanceEdit: null, maintenanceDelete: null,
      vehicleIds: null,
      createdAt: new Date(), updatedAt: new Date(),
    };
  }
}
