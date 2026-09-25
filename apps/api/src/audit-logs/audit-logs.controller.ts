import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuditLogsService } from './audit-logs.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('audit-logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private svc: AuditLogsService) {}

  @Get()
  findAll(
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
    @Query('orgId') orgId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.findAll({ action, entityType, userId, orgId, status, search, from, to, limit: limit ? +limit : 50, offset: offset ? +offset : 0 });
  }

  @Get('actors')
  getActors() { return this.svc.getActors(); }

  @Get('export')
  async export(
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('userId') userId?: string,
    @Query('orgId') orgId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Res() res?: Response,
  ) {
    const { data } = await this.svc.findAll({ action, entityType, userId, orgId, status, search, from, to, limit: 10000 });
    const csv = this.svc.toCsv(data);
    res!.setHeader('Content-Type', 'text/csv');
    res!.setHeader('Content-Disposition', `attachment; filename="audit-logs-${Date.now()}.csv"`);
    res!.send(csv);
  }
}
