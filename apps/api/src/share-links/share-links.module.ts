import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShareLink } from './entities/share-link.entity.js';
import { ShareLinksService } from './share-links.service.js';
import { ShareLinksController } from './share-links.controller.js';
import { TelemetryModule } from '../telemetry/telemetry.module.js';
import { DevicesModule } from '../devices/devices.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([ShareLink]), TelemetryModule, DevicesModule],
  providers: [ShareLinksService],
  controllers: [ShareLinksController],
})
export class ShareLinksModule {}
