import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleGroup } from './entities/vehicle-group.entity.js';
import { VehicleGroupMembership } from './entities/vehicle-group-membership.entity.js';
import { VehicleGroupsService } from './vehicle-groups.service.js';
import { VehicleGroupsController } from './vehicle-groups.controller.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { OrgPermissionsModule } from '../org-permissions/org-permissions.module.js';
import { RolePortalPermissionsModule } from '../role-portal-permissions/role-portal-permissions.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleGroup, VehicleGroupMembership, Vehicle]), OrgPermissionsModule, RolePortalPermissionsModule],
  providers: [VehicleGroupsService],
  controllers: [VehicleGroupsController],
  exports: [VehicleGroupsService],
})
export class VehicleGroupsModule {}
