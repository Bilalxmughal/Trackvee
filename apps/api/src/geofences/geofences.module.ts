import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Geofence } from './entities/geofence.entity.js';
import { GeofencesService } from './geofences.service.js';
import { GeofencesController } from './geofences.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Geofence])],
  providers: [GeofencesService],
  controllers: [GeofencesController],
  exports: [GeofencesService],
})
export class GeofencesModule {}
