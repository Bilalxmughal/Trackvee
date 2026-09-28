import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';

import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { OrgPermissionsModule } from '../org-permissions/org-permissions.module.js';
import { RolePortalPermissionsModule } from '../role-portal-permissions/role-portal-permissions.module.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { VehicleGroup } from '../vehicle-groups/entities/vehicle-group.entity.js';
import { VehicleGroupMembership } from '../vehicle-groups/entities/vehicle-group-membership.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Vehicle, VehicleGroup, VehicleGroupMembership]), AuditLogsModule, OrgPermissionsModule, RolePortalPermissionsModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
