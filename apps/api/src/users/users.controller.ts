import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from './entities/user.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';

function getIp(req: Request): string { return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''; }

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService, private audit: AuditLogsService) {}

  @Get()
  findAll(@Query('role') role?: string, @Query('cityId') cityId?: string) {
    return this.usersService.findAll(role, cityId);
  }

  @Get('org-users')
  findOrgUsers(@Query('organizationId') organizationId?: string) {
    return this.usersService.findOrgUsers(organizationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post()
  async create(@Body() body: any, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.usersService.create(body);
    this.audit.log({ user, ip: getIp(req) }, { action: 'create', entityType: 'user', entityId: result.id, entityName: `${result.firstName ?? ''} ${result.lastName ?? ''}`.trim() || result.email }).catch(() => {});
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: User, @Req() req: Request) {
    const result = await this.usersService.update(id, body);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'user', entityId: id, entityName: body.name ?? body.email }).catch(() => {});
    return result;
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    await this.usersService.remove(id);
    this.audit.log({ user, ip: getIp(req) }, { action: 'delete', entityType: 'user', entityId: id }).catch(() => {});
  }

  @Post(':id/revoke')
  async revoke(@Param('id') id: string, @CurrentUser() user: User, @Req() req: Request) {
    if (user.role !== 'super_admin' && user.role !== 'admin') throw new ForbiddenException();
    await this.usersService.revoke(id);
    this.audit.log({ user, ip: getIp(req) }, { action: 'update', entityType: 'user', entityId: id, details: { action: 'revoke' } }).catch(() => {});
    return { ok: true };
  }
}
