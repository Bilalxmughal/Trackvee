import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleGroup } from './entities/vehicle-group.entity.js';
import { VehicleGroupMembership } from './entities/vehicle-group-membership.entity.js';
import { VehicleGroupsService } from './vehicle-groups.service.js';
import { VehicleGroupsController } from './vehicle-groups.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleGroup, VehicleGroupMembership])],
  providers: [VehicleGroupsService],
  controllers: [VehicleGroupsController],
  exports: [VehicleGroupsService],
})
export class VehicleGroupsModule {}
