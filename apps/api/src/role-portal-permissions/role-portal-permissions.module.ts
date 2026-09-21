import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolePortalPermission } from './role-portal-permission.entity.js';
import { RolePortalPermissionsService } from './role-portal-permissions.service.js';
import { RolePortalPermissionsController } from './role-portal-permissions.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([RolePortalPermission])],
  providers: [RolePortalPermissionsService],
  controllers: [RolePortalPermissionsController],
  exports: [RolePortalPermissionsService],
})
export class RolePortalPermissionsModule {}
