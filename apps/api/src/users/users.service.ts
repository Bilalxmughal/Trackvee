import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity.js';
import type { UserRole } from '@yotrack/types';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email }, select: { id: true, email: true, password: true, role: true, firstName: true, lastName: true, isActive: true, organizationId: true, createdAt: true, updatedAt: true } });
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

  async findAll(role?: string): Promise<User[]> {
    if (role) return this.repo.find({ where: { role: role as UserRole } });
    return this.repo.find();
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

  async updateRole(id: string, role: UserRole): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    return this.repo.save(user);
  }
}
