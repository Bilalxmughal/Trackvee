import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Airline } from './entities/airline.entity.js';
import { AirlineCrew } from './entities/airline-crew.entity.js';
import { AirlineVehicle } from './entities/airline-vehicle.entity.js';
import { CrewTrip } from './entities/crew-trip.entity.js';
import { AirlineAirport } from './entities/airline-airport.entity.js';
import { AirlinesService } from './airlines.service.js';
import { AirlinesController } from './airlines.controller.js';
import { AirlinesPublicController } from './airlines-public.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Airline, AirlineCrew, AirlineVehicle, CrewTrip, AirlineAirport]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '8h') },
      }),
    }),
  ],
  providers: [AirlinesService],
  controllers: [AirlinesController, AirlinesPublicController],
  exports: [AirlinesService],
})
export class AirlinesModule {}
