import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Telemetry }    from '../telemetry/entities/telemetry.entity.js';
import { Device }       from '../devices/entities/device.entity.js';
import { Vehicle }      from '../vehicles/entities/vehicle.entity.js';
import { AlertLog }     from '../alerts/entities/alert-log.entity.js';
import { Alert }        from '../alerts/entities/alert.entity.js';
import { DriverEvent }  from '../driver-behavior/entities/driver-event.entity.js';
import { Geofence }     from '../geofences/entities/geofence.entity.js';
import { SavedReport }       from './entities/saved-report.entity.js';
import { ReportsService }    from './reports.service.js';
import { ReportsController } from './reports.controller.js';
import { OrgPermissionsModule } from '../org-permissions/org-permissions.module.js';
import { RolePortalPermissionsModule } from '../role-portal-permissions/role-portal-permissions.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetry, Device, Vehicle, AlertLog, Alert, DriverEvent, Geofence, SavedReport]), OrgPermissionsModule, RolePortalPermissionsModule],
  providers: [ReportsService],
  controllers: [ReportsController],
})
export class ReportsModule {}
