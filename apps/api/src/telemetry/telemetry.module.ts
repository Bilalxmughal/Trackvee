import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Telemetry } from './entities/telemetry.entity.js';
import { TelemetryService } from './telemetry.service.js';
import { TelemetryController } from './telemetry.controller.js';
import { DevicesModule } from '../devices/devices.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Telemetry]), DevicesModule],
  providers: [TelemetryService],
  controllers: [TelemetryController],
  exports: [TelemetryService],
})
export class TelemetryModule {}
