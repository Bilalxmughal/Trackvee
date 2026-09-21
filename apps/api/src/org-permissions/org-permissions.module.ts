import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgPermission } from './entities/org-permission.entity.js';
import { OrgPermissionsService } from './org-permissions.service.js';
import { OrgPermissionsController } from './org-permissions.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([OrgPermission])],
  providers: [OrgPermissionsService],
  controllers: [OrgPermissionsController],
  exports: [OrgPermissionsService],
})
export class OrgPermissionsModule {}
