import { Controller, Post, Get, Body, UseGuards, HttpCode, HttpStatus, Param, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { User } from '../users/entities/user.entity.js';
import { AuditLogsService } from '../audit-logs/audit-logs.service.js';

function getIp(req: Request): string { return (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.ip || ''; }

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService, private audit: AuditLogsService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    try {
      const result = await this.authService.login(dto);
      this.audit.log(
        { ip: getIp(req) },
        { action: 'login', entityType: 'session', entityName: dto.email, status: 'success' },
      ).catch(() => {});
      return result;
    } catch (err) {
      this.audit.log(
        { ip: getIp(req) },
        { action: 'login', entityType: 'session', entityName: dto.email, status: 'failed', details: { reason: 'invalid credentials' } },
      ).catch(() => {});
      throw err;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: User) {
    return this.authService.me(user.id);
  }

  @Post('impersonate/:userId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  impersonate(@Param('userId') userId: string, @Req() req: any) {
    return this.authService.impersonate(userId, req.user);
  }
}
