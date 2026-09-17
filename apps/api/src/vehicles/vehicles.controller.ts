import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('vehicles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.vehiclesService.findForUser(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.vehiclesService.findOne(id, user);
  }

  @Post()
  create(@Body() body: Partial<User>, @CurrentUser() user: User) {
    return this.vehiclesService.create(body as any, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<User>, @CurrentUser() user: User) {
    return this.vehiclesService.update(id, body as any, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.vehiclesService.remove(id, user);
  }
}
