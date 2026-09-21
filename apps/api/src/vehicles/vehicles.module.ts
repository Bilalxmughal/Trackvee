import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './entities/vehicle.entity.js';
import { Device } from '../devices/entities/device.entity.js';
import { VehiclesService } from './vehicles.service.js';
import { VehiclesController } from './vehicles.controller.js';
import { OrgPermissionsModule } from '../org-permissions/org-permissions.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, Device]), OrgPermissionsModule],
  providers: [VehiclesService],
  controllers: [VehiclesController],
  exports: [VehiclesService],
})
export class VehiclesModule {}
