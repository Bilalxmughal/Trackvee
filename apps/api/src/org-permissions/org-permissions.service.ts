import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
  dashboardView?: boolean | null; mapView?: boolean | null;
  vehicleIds?: string[] | null;
}

@Injectable()
export class OrgPermissionsService {
  private readonly organizationTypes = new Map<string, { type: string | null; at: number }>();
  constructor(
    @InjectRepository(OrgPermission)
    private repo: Repository<OrgPermission>,
    private dataSource: DataSource,
  ) {}

  async findByOrg(orgId?: string): Promise<OrgPermission[]> { return this.repo.find({ where: orgId ? { orgId } : {} }); }

  async organizationType(orgId: string): Promise<string | null> {
    const cached = this.organizationTypes.get(orgId);
    if (cached && Date.now() - cached.at < 300_000) return cached.type;
    const [row] = await this.dataSource.query('SELECT type FROM organizations WHERE id = $1', [orgId]);
    const type = row?.type ?? null; this.organizationTypes.set(orgId, { type, at: Date.now() }); return type;
  }

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
      id: '', userId, orgId, dashboardView: null, mapView: null,
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
