import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AlertsService } from './alerts.service.js';
import { Alert } from './entities/alert.entity.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private svc: AlertsService) {}

  @Get()
  findAll(@CurrentUser() user: User) { return this.svc.findAll(user); }

  @Get('logs')
  getLogs(@Query('alertId') alertId?: string, @Query('limit') limit?: string) {
    return this.svc.getLogs(alertId, limit ? +limit : 100);
  }

  @Post()
  create(@CurrentUser() user: User, @Body() dto: Partial<Alert>) { return this.svc.create(user, dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<Alert>) { return this.svc.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
