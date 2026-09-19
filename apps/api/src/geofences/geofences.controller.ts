import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GeofencesService } from './geofences.service.js';
import { Geofence } from './entities/geofence.entity.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('geofences')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('geofences')
export class GeofencesController {
  constructor(private svc: GeofencesService) {}

  @Get()
  findAll(@CurrentUser() user: User) { return this.svc.findAll(user); }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: Partial<Geofence>) { return this.svc.create(user, dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<Geofence>) { return this.svc.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
