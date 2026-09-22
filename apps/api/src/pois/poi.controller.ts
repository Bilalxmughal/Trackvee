import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PoisService } from './poi.service.js';
import { Poi } from './entities/poi.entity.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';

@ApiTags('pois')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pois')
export class PoisController {
  constructor(private svc: PoisService) {}

  @Get()
  findAll(@CurrentUser() user: User, @Query('orgId') orgId?: string) { return this.svc.findAll(user, orgId); }

  @Post()
  create(@CurrentUser() user: User, @Query('orgId') orgId: string | undefined, @Body() dto: Partial<Poi>) { return this.svc.create(user, dto, orgId); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: Partial<Poi>) { return this.svc.update(id, dto); }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
