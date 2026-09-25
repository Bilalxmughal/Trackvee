import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity.js';
import { OrganizationsService } from './organizations.service.js';
import { OrganizationsController } from './organizations.controller.js';
import { UsersModule } from '../users/users.module.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Organization]), UsersModule, AuditLogsModule],
  providers: [OrganizationsService],
  controllers: [OrganizationsController],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
