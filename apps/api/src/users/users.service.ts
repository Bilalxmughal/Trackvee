import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity.js';
import type { UserRole } from '@yotrack/types';

export type UserWithOrg = User & { organizationName?: string; organizationType?: string };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByIdWithOrg(id: string): Promise<UserWithOrg | null> {
    const user = await this.findById(id);
    if (!user || !user.organizationId) return user;
    const [org] = await this.dataSource.query(
      'SELECT name, type FROM organizations WHERE id = $1',
      [user.organizationId],
    );
    if (!org) return user;
    return { ...user, organizationName: org.name as string, organizationType: org.type as string };
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email }, select: { id: true, email: true, password: true, role: true, firstName: true, lastName: true, isActive: true, organizationId: true, tokenVersion: true, lastLoginAt: true, createdAt: true, updatedAt: true } });
  }

  async create(data: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role?: UserRole;
    organizationId?: string;
  }): Promise<User> {
    const existing = await this.repo.findOne({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(data.password, 12);
    const user = this.repo.create({
      ...data,
      password: hashed,
      role: data.role ?? 'customer',
    });
    return this.repo.save(user);
  }

  async findAll(role?: string, cityId?: string): Promise<User[]> {
    const where: Record<string, unknown> = {};
    if (role) where['role'] = role as UserRole;
    if (cityId) where['cityId'] = cityId;
    return this.repo.find({ where: Object.keys(where).length ? where : {} });
  }

  async update(id: string, data: Partial<{ email: string; password: string; firstName: string; lastName: string; role: UserRole; isActive: boolean; organizationId: string | null }>): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (data.password) {
      data = { ...data, password: await bcrypt.hash(data.password, 12) };
    }
    Object.assign(user, data);
    return this.repo.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.repo.remove(user);
  }

  async findByOrgRole(organizationId: string, role: UserRole): Promise<User | null> {
    return this.repo.findOne({ where: { organizationId, role } });
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    return this.repo.save(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.repo.update(id, { lastLoginAt: new Date() });
  }

  async revoke(id: string): Promise<void> {
    await this.repo.increment({ id }, 'tokenVersion', 1);
  }

  async findOrgUsers(organizationId?: string): Promise<User[]> {
    const ORG_ROLES: UserRole[] = ['org_owner', 'org_admin', 'org_user', 'customer'];
    if (organizationId) {
      return this.repo.find({ where: ORG_ROLES.map(r => ({ organizationId, role: r })) });
    }
    return this.repo.find({ where: ORG_ROLES.map(r => ({ role: r })) });
  }
}
