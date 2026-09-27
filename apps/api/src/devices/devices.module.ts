import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity.js';
import { DevicesService } from './devices.service.js';
import { DevicesController } from './devices.controller.js';

import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { OrgPermissionsModule } from '../org-permissions/org-permissions.module.js';
import { RolePortalPermissionsModule } from '../role-portal-permissions/role-portal-permissions.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Device]), AuditLogsModule, OrgPermissionsModule, RolePortalPermissionsModule],
  providers: [DevicesService],
  controllers: [DevicesController],
  exports: [DevicesService],
})
export class DevicesModule {}
