import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverEvent } from './entities/driver-event.entity.js';
import { DriverScore } from './entities/driver-score.entity.js';
import { DriverBehaviorSettings } from './entities/driver-behavior-settings.entity.js';
import { DriverBehaviorService } from './driver-behavior.service.js';
import { DriverBehaviorController } from './driver-behavior.controller.js';
import { AlertsModule } from '../alerts/alerts.module.js';
import { VehicleGroupsModule } from '../vehicle-groups/vehicle-groups.module.js';
import { RolePortalPermissionsModule } from '../role-portal-permissions/role-portal-permissions.module.js';
import { Vehicle } from '../vehicles/entities/vehicle.entity.js';
import { VehicleGroup } from '../vehicle-groups/entities/vehicle-group.entity.js';
import { VehicleGroupMembership } from '../vehicle-groups/entities/vehicle-group-membership.entity.js';
import { OrgPermissionsModule } from '../org-permissions/org-permissions.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([DriverEvent, DriverScore, DriverBehaviorSettings, Vehicle, VehicleGroup, VehicleGroupMembership]), AlertsModule, VehicleGroupsModule, RolePortalPermissionsModule, OrgPermissionsModule],
  providers: [DriverBehaviorService],
  controllers: [DriverBehaviorController],
  exports: [DriverBehaviorService],
})
export class DriverBehaviorModule {}
