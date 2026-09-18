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
  ],
})
export class AppModule {}
