import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Poi } from './entities/poi.entity.js';
import { PoisController } from './poi.controller.js';
import { PoisService } from './poi.service.js';

import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';
import { OrgPermissionsModule } from '../org-permissions/org-permissions.module.js';
import { RolePortalPermissionsModule } from '../role-portal-permissions/role-portal-permissions.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Poi]), AuditLogsModule, OrgPermissionsModule, RolePortalPermissionsModule],
  controllers: [PoisController],
  providers: [PoisService],
})
export class PoisModule {}
