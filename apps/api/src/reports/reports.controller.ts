import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService, ReportType } from './reports.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private svc: ReportsService) {}

  @Get()
  async generate(
    @Query('type')        type: ReportType,
    @Query('vehicleIds')  vehicleIds: string,
    @Query('from')        from: string,
    @Query('to')          to: string,
    @Query('speedLimit')  speedLimit?: string,
    @Query('minSpeedKmh') minSpeedKmh?: string,
    @Query('minStopMin')  minStopMin?: string,
    @Query('geofenceIds') geofenceIds?: string,
  ) {
    return this.svc.generate({
      type,
      vehicleIds:  vehicleIds ? vehicleIds.split(',').filter(Boolean) : [],
      from:        new Date(from),
      to:          new Date(to),
      speedLimit:  speedLimit  ? +speedLimit  : undefined,
      minSpeedKmh: minSpeedKmh ? +minSpeedKmh : undefined,
      minStopMin:  minStopMin  ? +minStopMin  : undefined,
      geofenceIds: geofenceIds ? geofenceIds.split(',').filter(Boolean) : undefined,
    });
  }

  @Get('export')
  async export(
    @Query('type')        type: ReportType,
    @Query('vehicleIds')  vehicleIds: string,
    @Query('from')        from: string,
    @Query('to')          to: string,
    @Query('speedLimit')  speedLimit?: string,
    @Query('minSpeedKmh') minSpeedKmh?: string,
    @Query('minStopMin')  minStopMin?: string,
    @Query('geofenceIds') geofenceIds?: string,
    @Res() res?: Response,
  ) {
    const result = await this.svc.generate({
      type,
      vehicleIds:  vehicleIds ? vehicleIds.split(',').filter(Boolean) : [],
      from:        new Date(from),
      to:          new Date(to),
      speedLimit:  speedLimit  ? +speedLimit  : undefined,
      minSpeedKmh: minSpeedKmh ? +minSpeedKmh : undefined,
      minStopMin:  minStopMin  ? +minStopMin  : undefined,
      geofenceIds: geofenceIds ? geofenceIds.split(',').filter(Boolean) : undefined,
    });
    const csv = this.svc.toCsv(result);
    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader('Content-Disposition', `attachment; filename="report-${type}-${Date.now()}.csv"`);
    res!.send(csv);
  }
}
