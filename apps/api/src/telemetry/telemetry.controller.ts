import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('telemetry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telemetry')
export class TelemetryController {
  constructor(private telemetryService: TelemetryService) {}

  @Get()
  findRecent(@CurrentUser() user: User, @Query('limit') limit?: string) {
    return this.telemetryService.findRecent(user, limit ? parseInt(limit) : 100);
  }

  @Get(':imei/latest')
  getLatest(@Param('imei') imei: string) {
    return this.telemetryService.getLatest(imei);
  }

  @Get(':imei/history')
  getHistory(@Param('imei') imei: string, @Query('limit') limit?: string) {
    return this.telemetryService.getHistory(imei, limit ? parseInt(limit) : 100);
  }
}
