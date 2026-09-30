import { Injectable, UnauthorizedException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.isActive) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.usersService.updateLastLogin(user.id);

    const payload = { sub: user.id, email: user.email, role: user.role, tv: user.tokenVersion };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
    });

    const loginUser = await this.usersService.findByIdWithOrg(user.id) ?? user;
    const { password: _, ...userWithoutPassword } = loginUser;
    void _;

    return { accessToken, refreshToken, user: userWithoutPassword };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{ sub: string; email: string; role: string; tv: number }>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) throw new Error();
      if (user.tokenVersion !== payload.tv) throw new Error('revoked');
      const newPayload = { sub: user.id, email: user.email, role: user.role, tv: user.tokenVersion };
      return { accessToken: this.jwtService.sign(newPayload) };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async me(userId: string) {
    return this.usersService.findByIdWithOrg(userId);
  }

  async impersonate(targetUserId: string, requestingUser: { role: string }) {
    if (requestingUser.role !== 'super_admin') throw new ForbiddenException('Only super_admin can impersonate');
    const target = await this.usersService.findById(targetUserId);
    if (!target) throw new NotFoundException('User not found');
    const payload = { sub: target.id, email: target.email, role: target.role, tv: target.tokenVersion, imp: true };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '2h' });
    return { accessToken, user: target };
  }
}
