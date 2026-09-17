import { Module } from '@nestjs/common';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { DevicesModule } from '../devices/devices.module.js';
import { TrackerService } from './tracker.service.js';

@Module({
  imports: [TelemetryModule, DevicesModule],
  providers: [TrackerService],
})
export class TrackerModule {}
