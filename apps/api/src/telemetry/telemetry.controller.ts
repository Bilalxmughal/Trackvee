import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TelemetryService } from './telemetry.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('telemetry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('telemetry')
export class TelemetryController {
  constructor(private telemetryService: TelemetryService) {}

  @Get(':imei/latest')
  getLatest(@Param('imei') imei: string) {
    return this.telemetryService.getLatest(imei);
  }

  @Get(':imei/history')
  getHistory(@Param('imei') imei: string, @Query('limit') limit?: string) {
    return this.telemetryService.getHistory(imei, limit ? parseInt(limit) : 100);
  }
}
