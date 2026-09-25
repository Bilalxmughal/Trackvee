import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Geofence } from './entities/geofence.entity.js';
import { GeofencesService } from './geofences.service.js';
import { GeofencesController } from './geofences.controller.js';

import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Geofence]), AuditLogsModule],
  providers: [GeofencesService],
  controllers: [GeofencesController],
  exports: [GeofencesService],
})
export class GeofencesModule {}
