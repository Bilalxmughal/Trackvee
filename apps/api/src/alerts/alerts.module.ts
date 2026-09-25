import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from './entities/alert.entity.js';
import { AlertLog } from './entities/alert-log.entity.js';
import { AlertsService } from './alerts.service.js';
import { AlertsController } from './alerts.controller.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Alert, AlertLog]), AuditLogsModule],
  providers: [AlertsService],
  controllers: [AlertsController],
  exports: [AlertsService],
})
export class AlertsModule {}
