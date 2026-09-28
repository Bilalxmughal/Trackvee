import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Geofence } from './entities/geofence.entity.js';
import { GeofencesService } from './geofences.service.js';
import { GeofencesController } from './geofences.controller.js';

import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { OrgPermissionsModule } from '../org-permissions/org-permissions.module.js';
import { RolePortalPermissionsModule } from '../role-portal-permissions/role-portal-permissions.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Geofence]), AuditLogsModule, OrgPermissionsModule, RolePortalPermissionsModule],
  providers: [GeofencesService],
  controllers: [GeofencesController],
  exports: [GeofencesService],
})
export class GeofencesModule {}
