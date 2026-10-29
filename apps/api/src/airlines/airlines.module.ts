import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Airline } from './entities/airline.entity.js';
import { AirlineCrew } from './entities/airline-crew.entity.js';
import { AirlineVehicle } from './entities/airline-vehicle.entity.js';
import { CrewTrip } from './entities/crew-trip.entity.js';
import { AirlinesService } from './airlines.service.js';
import { AirlinesController } from './airlines.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Airline, AirlineCrew, AirlineVehicle, CrewTrip])],
  providers: [AirlinesService],
  controllers: [AirlinesController],
  exports: [AirlinesService],
})
export class AirlinesModule {}
