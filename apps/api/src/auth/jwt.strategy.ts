import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { UsersService } from '../users/users.service.js';

interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  tv?: number;
  imp?: boolean;
  type?: string;
  vehicleId?: string;
  airlineId?: string;
  sessionId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private usersService: UsersService,
    private dataSource: DataSource,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Vehicle token — skip user lookup, check session revocation instead
    if (payload.type === 'vehicle') {
      if (!payload.vehicleId || !payload.airlineId || !payload.sessionId) throw new UnauthorizedException();
      const rows = await this.dataSource.query(
        `SELECT 1 FROM airline_vehicles WHERE vehicle_id = $1 AND airline_id = $2 AND active_session_id = $3`,
        [payload.vehicleId, payload.airlineId, payload.sessionId],
      );
      if (!rows.length) throw new UnauthorizedException('Vehicle session ended');
      return { vehicleId: payload.vehicleId, airlineId: payload.airlineId, sessionId: payload.sessionId, _isVehicle: true };
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    if (user.tokenVersion !== payload.tv) throw new UnauthorizedException('Session revoked');
    return { ...user, _isImpersonating: payload.imp === true };
  }
}
