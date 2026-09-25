import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';

import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuditLogsModule],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
