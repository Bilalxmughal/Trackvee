import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Telemetry }    from '../telemetry/entities/telemetry.entity.js';
import { Device }       from '../devices/entities/device.entity.js';
import { Vehicle }      from '../vehicles/entities/vehicle.entity.js';
import { AlertLog }     from '../alerts/entities/alert-log.entity.js';
import { Alert }        from '../alerts/entities/alert.entity.js';
import { DriverEvent }  from '../driver-behavior/entities/driver-event.entity.js';
import { Geofence }     from '../geofences/entities/geofence.entity.js';
import { ReportsService }    from './reports.service.js';
import { ReportsController } from './reports.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetry, Device, Vehicle, AlertLog, Alert, DriverEvent, Geofence])],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
