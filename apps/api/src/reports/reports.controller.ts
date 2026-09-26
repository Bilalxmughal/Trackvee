import { Controller, Get, Post, Delete, Param, Body, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService, ReportType } from './reports.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

const INTERNAL_ROLES = ['super_admin', 'admin', 'ops', 'live_ops', 'agent', 'chat_support', 'viewer'];

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private svc: ReportsService) {}

  @Get()
  async generate(
    @CurrentUser()        user: User,
    @Query('type')        type: ReportType,
    @Query('vehicleIds')  vehicleIds: string,
    @Query('from')        from: string,
    @Query('to')          to: string,
    @Query('speedLimit')  speedLimit?: string,
    @Query('minSpeedKmh') minSpeedKmh?: string,
    @Query('minStopMin')  minStopMin?: string,
    @Query('geofenceIds') geofenceIds?: string,
    @Query('groupBy')     groupBy?: string,
  ) {
    const orgId = INTERNAL_ROLES.includes(user.role) ? undefined : (user.organizationId ?? undefined);
    return this.svc.generate({
      type,
      vehicleIds:     vehicleIds ? vehicleIds.split(',').filter(Boolean) : [],
      from:           new Date(from),
      to:             new Date(to),
      speedLimit:     speedLimit  ? +speedLimit  : undefined,
      minSpeedKmh:    minSpeedKmh ? +minSpeedKmh : undefined,
      minStopMin:     minStopMin  ? +minStopMin  : undefined,
      geofenceIds:    geofenceIds ? geofenceIds.split(',').filter(Boolean) : undefined,
      organizationId: orgId,
      groupBy:        (groupBy as 'day'|'week'|'month'|undefined) || undefined,
    });
  }

  @Get('export')
  async export(
    @CurrentUser()        user: User,
    @Query('type')        type: ReportType,
    @Query('vehicleIds')  vehicleIds: string,
    @Query('from')        from: string,
    @Query('to')          to: string,
    @Query('speedLimit')  speedLimit?: string,
    @Query('minSpeedKmh') minSpeedKmh?: string,
    @Query('minStopMin')  minStopMin?: string,
    @Query('geofenceIds') geofenceIds?: string,
    @Query('groupBy')     groupBy?: string,
    @Res() res?: Response,
  ) {
    const orgId = INTERNAL_ROLES.includes(user.role) ? undefined : (user.organizationId ?? undefined);
    const result = await this.svc.generate({
      type,
      vehicleIds:     vehicleIds ? vehicleIds.split(',').filter(Boolean) : [],
      from:           new Date(from),
      to:             new Date(to),
      speedLimit:     speedLimit  ? +speedLimit  : undefined,
      minSpeedKmh:    minSpeedKmh ? +minSpeedKmh : undefined,
      minStopMin:     minStopMin  ? +minStopMin  : undefined,
      geofenceIds:    geofenceIds ? geofenceIds.split(',').filter(Boolean) : undefined,
      organizationId: orgId,
      groupBy:        (groupBy as 'day'|'week'|'month'|undefined) || undefined,
    });
    const csv = this.svc.toCsv(result);
    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader('Content-Disposition', `attachment; filename="report-${type}-${Date.now()}.csv"`);
    res!.send(csv);
  }

  @Get('saved')
  listSaved(@CurrentUser() user: User) {
    const orgId = INTERNAL_ROLES.includes(user.role) ? null : (user.organizationId ?? null);
    return this.svc.listSaved(user.id, orgId);
  }

  @Post('saved')
  saveReport(
    @CurrentUser() user: User,
    @Body() body: { title: string; type: string; params: Record<string, unknown> },
  ) {
    const orgId    = INTERNAL_ROLES.includes(user.role) ? null : (user.organizationId ?? null);
    const userName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
    return this.svc.saveReport(body, user.id, userName, orgId);
  }

  @Delete('saved/:id')
  deleteSaved(@CurrentUser() user: User, @Param('id') id: string) {
    const orgId = INTERNAL_ROLES.includes(user.role) ? null : (user.organizationId ?? null);
    return this.svc.deleteSaved(id, user.id, orgId);
  }
}
