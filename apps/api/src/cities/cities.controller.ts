import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CitiesService } from './cities.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';

@ApiTags('cities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cities')
export class CitiesController {
  constructor(private citiesService: CitiesService) {}

  @Get()
  findAll() {
    return this.citiesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.citiesService.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<any>) {
    return this.citiesService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<any>) {
    return this.citiesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.citiesService.remove(id);
  }
}
