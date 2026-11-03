import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from './session.service';

export type StaffIdentity = NonNullable<
  Awaited<ReturnType<SessionService['validate']>>
>;

export interface AuthenticatedRequest extends Request {
  staff?: StaffIdentity;
  staffToken?: string;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    const match = /^Bearer ([a-f0-9]{64})$/.exec(
      authorization ?? '',
    );

    if (!match) {
      throw new UnauthorizedException('Invalid session');
    }

    const token = match[1];
    const identity = await this.sessions.validate(token);

    if (!identity) {
      throw new UnauthorizedException('Invalid session');
    }

    request.staff = identity;
    request.staffToken = token;

    return true;
  }
}
