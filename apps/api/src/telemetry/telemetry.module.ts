import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Telemetry } from './entities/telemetry.entity.js';
import { TelemetryService } from './telemetry.service.js';
import { TelemetryController } from './telemetry.controller.js';
import { DevicesModule } from '../devices/devices.module.js';
import { AlertsModule } from '../alerts/alerts.module.js';
import { GeofencesModule } from '../geofences/geofences.module.js';
import { DriverBehaviorModule } from '../driver-behavior/driver-behavior.module.js';
import { SpeedZonesModule } from '../speed-zones/speed-zones.module.js';
import { MaintenanceModule } from '../maintenance/maintenance.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetry]), DevicesModule, AlertsModule, GeofencesModule, DriverBehaviorModule, SpeedZonesModule, MaintenanceModule],
  providers: [TelemetryService],
  controllers: [TelemetryController],
  exports: [TelemetryService],
})
export class TelemetryModule {}
