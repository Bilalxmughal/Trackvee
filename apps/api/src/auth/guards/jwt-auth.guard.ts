import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

export const AllowVehicleSession = Reflector.createDecorator<boolean>();

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override handleRequest<TUser>(err: unknown, user: TUser, info: unknown, context: ExecutionContext): TUser {
    const authenticated = super.handleRequest<TUser>(err, user, info, context);
    if ((authenticated as { _isVehicle?: boolean })._isVehicle === true
      && !this.reflector.get(AllowVehicleSession, context.getHandler())) {
      throw new UnauthorizedException('Vehicle session is not valid for this endpoint');
    }
    return authenticated;
  }
}
