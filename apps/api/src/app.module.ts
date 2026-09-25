import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { VehiclesModule } from './vehicles/vehicles.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { TelemetryModule } from './telemetry/telemetry.module.js';
import { CitiesModule } from './cities/cities.module.js';
import { GeofencesModule } from './geofences/geofences.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { PoisModule } from './pois/poi.module.js';
import { OrgPermissionsModule } from './org-permissions/org-permissions.module.js';
import { RolePortalPermissionsModule } from './role-portal-permissions/role-portal-permissions.module.js';
import { DriverBehaviorModule } from './driver-behavior/driver-behavior.module.js';
import { VehicleGroupsModule } from './vehicle-groups/vehicle-groups.module.js';
import { SpeedZonesModule } from './speed-zones/speed-zones.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    VehiclesModule,
    DevicesModule,
    TelemetryModule,
    CitiesModule,
    GeofencesModule,
    AlertsModule,
    PoisModule,
    OrgPermissionsModule,
    RolePortalPermissionsModule,
    DriverBehaviorModule,
    VehicleGroupsModule,
    SpeedZonesModule,
  ],
})
export class AppModule {}
