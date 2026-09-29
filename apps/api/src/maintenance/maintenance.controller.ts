import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { User } from '../users/entities/user.entity.js';
import { MaintenanceInput, MaintenanceService } from './maintenance.service.js';

@ApiTags('maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get('vehicles')
  listVehicles(@CurrentUser() user: User, @Query('organizationId') organizationId?: string) {
    return this.service.listVehicles(user, organizationId);
  }

  @Get()
  list(@CurrentUser() user: User, @Query('organizationId') organizationId?: string, @Query('vehicleId') vehicleId?: string, @Query('status') status?: string) {
    return this.service.list(user, { organizationId, vehicleId, status });
  }

  @Post()
  create(@CurrentUser() user: User, @Query('organizationId') organizationId: string | undefined, @Body() body: MaintenanceInput) {
    return this.service.create(user, body, organizationId);
  }

  @Put(':id')
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() body: MaintenanceInput) {
    return this.service.update(user, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
