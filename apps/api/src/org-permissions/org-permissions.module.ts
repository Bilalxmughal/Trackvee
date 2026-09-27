import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgPermission } from './entities/org-permission.entity.js';
import { OrgPermissionsService } from './org-permissions.service.js';
import { OrgPermissionsController } from './org-permissions.controller.js';
import { User } from '../users/entities/user.entity.js';
import { RolePortalPermissionsModule } from '../role-portal-permissions/role-portal-permissions.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([OrgPermission, User]), RolePortalPermissionsModule],
  providers: [OrgPermissionsService],
  controllers: [OrgPermissionsController],
  exports: [OrgPermissionsService],
})
export class OrgPermissionsModule {}
