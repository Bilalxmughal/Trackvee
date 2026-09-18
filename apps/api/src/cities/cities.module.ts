import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from './entities/city.entity.js';
import { CitiesService } from './cities.service.js';
import { CitiesController } from './cities.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([City])],
  providers: [CitiesService],
  controllers: [CitiesController],
  exports: [CitiesService],
})
export class CitiesModule {}
