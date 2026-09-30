import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './entities/vehicle.entity.js';
import { Device } from '../devices/entities/device.entity.js';
import { VehiclesService } from './vehicles.service.js';
import { VehiclesController } from './vehicles.controller.js';
import { OrgPermissionsModule } from '../org-permissions/org-permissions.module.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { RolePortalPermissionsModule } from '../role-portal-permissions/role-portal-permissions.module.js';
import { DevicesModule } from '../devices/devices.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, Device]), DevicesModule, OrgPermissionsModule, RolePortalPermissionsModule, AuditLogsModule],
  providers: [VehiclesService],
  controllers: [VehiclesController],
  exports: [VehiclesService],
})
export class VehiclesModule {}
