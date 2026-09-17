import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from './entities/device.entity.js';
import { DevicesService } from './devices.service.js';
import { DevicesController } from './devices.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Device])],
  providers: [DevicesService],
  controllers: [DevicesController],
  exports: [DevicesService],
})
export class DevicesModule {}
