import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from './entities/alert.entity.js';
import { AlertLog } from './entities/alert-log.entity.js';
import { AlertsService } from './alerts.service.js';
import { AlertsController } from './alerts.controller.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { OrgPermissionsModule } from '../org-permissions/org-permissions.module.js';
import { RolePortalPermissionsModule } from '../role-portal-permissions/role-portal-permissions.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Alert, AlertLog]), AuditLogsModule, DevicesModule, OrgPermissionsModule, RolePortalPermissionsModule],
  providers: [AlertsService],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}
