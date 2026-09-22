import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverEvent } from './entities/driver-event.entity.js';
import { DriverScore } from './entities/driver-score.entity.js';
import { DriverBehaviorSettings } from './entities/driver-behavior-settings.entity.js';
import { DriverBehaviorService } from './driver-behavior.service.js';
import { DriverBehaviorController } from './driver-behavior.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([DriverEvent, DriverScore, DriverBehaviorSettings])],
  providers: [DriverBehaviorService],
  controllers: [DriverBehaviorController],
  exports: [DriverBehaviorService],
})
export class DriverBehaviorModule {}
