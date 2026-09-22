import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Organization } from './entities/organization.entity.js';
import { UsersService } from '../users/users.service.js';

export interface OrgWithStats extends Organization {
  customerCount: number;
  vehicleCount: number;
  deviceCount: number;
}

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private repo: Repository<Organization>,
    private usersService: UsersService,
    private dataSource: DataSource,
  ) {}

  async findAll(cityId?: string, type?: string): Promise<OrgWithStats[]> {
    const where: Record<string, unknown> = {};
    if (cityId) where['cityId'] = cityId;
    if (type) where['type'] = type;
    const orgs = await this.repo.find({ where: Object.keys(where).length ? where : {}, order: { createdAt: 'DESC' } });
    if (!orgs.length) return [];

    const stats: { org_id: string; customer_count: string; vehicle_count: string; device_count: string }[] =
      await this.dataSource.query(`
        SELECT
          o.id AS org_id,
          COALESCE(cu.cnt, 0)::int AS customer_count,
          COALESCE(ve.cnt, 0)::int AS vehicle_count,
          COALESCE(de.cnt, 0)::int AS device_count
        FROM organizations o
        LEFT JOIN (
          SELECT organization_id, COUNT(*) AS cnt
          FROM users WHERE role = 'client_user' AND is_active = true
          GROUP BY organization_id
        ) cu ON cu.organization_id = o.id
        LEFT JOIN (
          SELECT organization_id, COUNT(*) AS cnt
          FROM vehicles WHERE is_active = true
          GROUP BY organization_id
        ) ve ON ve.organization_id = o.id
        LEFT JOIN (
          SELECT v.organization_id, COUNT(d.id) AS cnt
          FROM devices d
          JOIN vehicles v ON v.id = d.vehicle_id
          WHERE d.status = 'active'
          GROUP BY v.organization_id
        ) de ON de.organization_id = o.id
      `);

    const statsMap = new Map(stats.map(s => [s.org_id, s]));

    return orgs.map(org => ({
      ...org,
      customerCount: Number(statsMap.get(org.id)?.customer_count ?? 0),
      vehicleCount: Number(statsMap.get(org.id)?.vehicle_count ?? 0),
      deviceCount: Number(statsMap.get(org.id)?.device_count ?? 0),
    }));
  }

  async findOne(id: string): Promise<OrgWithStats> {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    const [row]: { customer_count: string; vehicle_count: string; device_count: string }[] =
      await this.dataSource.query(`
        SELECT
          COALESCE(cu.cnt, 0)::int AS customer_count,
          COALESCE(ve.cnt, 0)::int AS vehicle_count,
          COALESCE(de.cnt, 0)::int AS device_count
        FROM (SELECT $1::uuid AS id) o
        LEFT JOIN (
          SELECT organization_id, COUNT(*) AS cnt
          FROM users WHERE organization_id = $1 AND role = 'client_user' AND is_active = true
          GROUP BY organization_id
        ) cu ON true
        LEFT JOIN (
          SELECT organization_id, COUNT(*) AS cnt
          FROM vehicles WHERE organization_id = $1 AND is_active = true
          GROUP BY organization_id
        ) ve ON true
        LEFT JOIN (
          SELECT COUNT(d.id) AS cnt
          FROM devices d
          JOIN vehicles v ON v.id = d.vehicle_id
          WHERE v.organization_id = $1 AND d.status = 'active'
        ) de ON true
      `, [id]);

    return {
      ...org,
      customerCount: Number(row?.customer_count ?? 0),
      vehicleCount: Number(row?.vehicle_count ?? 0),
      deviceCount: Number(row?.device_count ?? 0),
    };
  }

  async create(data: Partial<Organization> & { password?: string }, ownerId: string): Promise<OrgWithStats> {
    const { password, ...orgData } = data;

    if (orgData.email) {
      const existing = await this.usersService.findByEmail(orgData.email);
      if (existing) throw new ConflictException('Email already in use');
    }

    const base = (orgData.name ?? 'org').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let slug = base;
    let suffix = 1;
    while (await this.repo.findOne({ where: { slug } })) {
      slug = `${base}-${suffix++}`;
    }

    const org = this.repo.create({ ...orgData, slug, ownerId });
    const saved = await this.repo.save(org);

    if (saved.email && password) {
      await this.usersService.create({
        email: saved.email,
        password,
        firstName: saved.pocName ?? saved.name ?? undefined,
        role: 'client_owner',
        organizationId: saved.id,
      });
    }

    return { ...saved, customerCount: 0, vehicleCount: 0, deviceCount: 0 };
  }

  async remove(id: string): Promise<void> {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    await this.repo.remove(org);
  }

  async update(id: string, data: Partial<Organization> & { password?: string }): Promise<OrgWithStats> {
    const { password, ...orgData } = data;
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    Object.assign(org, orgData);
    const saved = await this.repo.save(org);

    if (password) {
      const loginUser = await this.usersService.findByOrgRole(id, 'client_owner');
      if (loginUser) await this.usersService.update(loginUser.id, { password });
    }

    return this.findOne(saved.id);
  }
}
