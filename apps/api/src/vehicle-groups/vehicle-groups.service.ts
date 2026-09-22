import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { VehicleGroup } from './entities/vehicle-group.entity.js';
import { VehicleGroupMembership } from './entities/vehicle-group-membership.entity.js';

export interface GroupWithVehicleIds {
  id: string;
  name: string;
  organizationId: string;
  vehicleIds: string[];
}

@Injectable()
export class VehicleGroupsService {
  constructor(
    @InjectRepository(VehicleGroup) private groupRepo: Repository<VehicleGroup>,
    @InjectRepository(VehicleGroupMembership) private memberRepo: Repository<VehicleGroupMembership>,
  ) {}

  async listGroups(organizationId: string): Promise<GroupWithVehicleIds[]> {
    const groups = await this.groupRepo.find({ where: { organizationId }, order: { name: 'ASC' } });
    if (!groups.length) return [];
    const memberships = await this.memberRepo.find({ where: { groupId: In(groups.map(g => g.id)) } });
    const memberMap = new Map<string, string[]>();
    for (const m of memberships) {
      if (!memberMap.has(m.groupId)) memberMap.set(m.groupId, []);
      memberMap.get(m.groupId)!.push(m.vehicleId);
    }
    return groups.map(g => ({
      id: g.id, name: g.name, organizationId: g.organizationId,
      vehicleIds: memberMap.get(g.id) ?? [],
    }));
  }

  async createGroup(organizationId: string, name: string, vehicleIds: string[]): Promise<GroupWithVehicleIds> {
    const group = await this.groupRepo.save(this.groupRepo.create({ organizationId, name }));
    await this.setMembers(group.id, vehicleIds);
    return { id: group.id, name: group.name, organizationId: group.organizationId, vehicleIds };
  }

  async updateGroup(groupId: string, orgId: string, name: string, vehicleIds: string[]): Promise<GroupWithVehicleIds> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, organizationId: orgId } });
    if (!group) throw new NotFoundException('Group not found');
    group.name = name;
    await this.groupRepo.save(group);
    await this.setMembers(groupId, vehicleIds);
    return { id: group.id, name: group.name, organizationId: group.organizationId, vehicleIds };
  }

  async deleteGroup(groupId: string, orgId: string): Promise<void> {
    const group = await this.groupRepo.findOne({ where: { id: groupId, organizationId: orgId } });
    if (!group) throw new NotFoundException('Group not found');
    await this.groupRepo.remove(group);
  }

  async getGroupForVehicle(vehicleId: string): Promise<string | null> {
    const m = await this.memberRepo.findOne({ where: { vehicleId } });
    return m?.groupId ?? null;
  }

  private async setMembers(groupId: string, vehicleIds: string[]): Promise<void> {
    // Remove all current members of this group
    await this.memberRepo.delete({ groupId });
    if (!vehicleIds.length) return;
    // Remove these vehicles from any other group (enforce one-group-per-vehicle)
    if (vehicleIds.length > 0) {
      const conflicting = await this.memberRepo.find({ where: { vehicleId: In(vehicleIds) } });
      if (conflicting.length) await this.memberRepo.remove(conflicting);
    }
    await this.memberRepo.save(vehicleIds.map(vehicleId => this.memberRepo.create({ vehicleId, groupId })));
  }
}
