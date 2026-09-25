import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpeedZone } from './entities/speed-zone.entity.js';
import { SpeedZonesService } from './speed-zones.service.js';
import { SpeedZonesController } from './speed-zones.controller.js';
import { AuditLogsModule } from '../audit-logs/audit-logs.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([SpeedZone]), AuditLogsModule],
  providers: [SpeedZonesService],
  controllers: [SpeedZonesController],
  exports: [SpeedZonesService],
})
export class SpeedZonesModule {}
