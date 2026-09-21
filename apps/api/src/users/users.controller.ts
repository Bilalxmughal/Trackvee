import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

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
  create(@Body() body: any) {
    return this.usersService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/revoke')
  async revoke(@Param('id') id: string, @Req() req: any) {
    const role = req.user?.role;
    if (role !== 'super_admin' && role !== 'admin') throw new ForbiddenException();
    await this.usersService.revoke(id);
    return { ok: true };
  }
}
