import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Poi } from './entities/poi.entity.js';
import { PoisController } from './poi.controller.js';
import { PoisService } from './poi.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Poi])],
  controllers: [PoisController],
  providers: [PoisService],
})
export class PoisModule {}
