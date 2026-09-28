import { Controller, Get, Post, Delete, Param, Body, Query, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { OrgPermissionsService } from '../org-permissions/org-permissions.service.js';
import { RolePortalPermissionsService } from '../role-portal-permissions/role-portal-permissions.service.js';
import { assertClientFeatureAccess, INTERNAL_ROLES } from '../org-permissions/client-feature-access.js';
import { ReportsService, ReportType } from './reports.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private svc: ReportsService,
    private orgPermissions: OrgPermissionsService,
    private rolePermissions: RolePortalPermissionsService,
  ) {}

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
    const orgId = await this.assertReportScope(user, vehicleIds);
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
    const orgId = await this.assertReportScope(user, vehicleIds);
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
    return this.assertClientFeatureAccess(user).then(() => {
      const orgId = INTERNAL_ROLES.has(user.role) ? null : (user.organizationId ?? null);
      return this.svc.listSaved(user.id, orgId);
    });
  }

  @Post('saved')
  saveReport(
    @CurrentUser() user: User,
    @Body() body: { title: string; type: string; params: Record<string, unknown> },
  ) {
    const orgId    = INTERNAL_ROLES.has(user.role) ? null : (user.organizationId ?? null);
    const userName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
    return this.assertClientFeatureAccess(user).then(() => this.svc.saveReport(body, user.id, userName, orgId));
  }

  @Delete('saved/:id')
  deleteSaved(@CurrentUser() user: User, @Param('id') id: string) {
    const orgId = INTERNAL_ROLES.has(user.role) ? null : (user.organizationId ?? null);
    return this.assertClientFeatureAccess(user).then(() => this.svc.deleteSaved(id, user.id, orgId));
  }

  private async assertClientFeatureAccess(user: User): Promise<void> {
    await assertClientFeatureAccess(user, 'reports', 'view', this.orgPermissions, this.rolePermissions);
  }

  private async assertReportScope(user: User, vehicleIds: string): Promise<string | undefined> {
    if (INTERNAL_ROLES.has(user.role)) return undefined;
    await this.assertClientFeatureAccess(user);
    if (!user.organizationId) throw new ForbiddenException('Organization access required');
    const grant = await this.orgPermissions.findByUser(user.id);
    if (grant && grant.orgId !== user.organizationId) throw new ForbiddenException();
    const selected = vehicleIds ? [...new Set(vehicleIds.split(',').filter(Boolean))] : [];
    const allowed = grant?.vehicleIds ?? null;
    if (allowed !== null && selected.some(id => !allowed.includes(id))) throw new ForbiddenException('Report vehicle access is not permitted');
    return user.organizationId;
  }
}
