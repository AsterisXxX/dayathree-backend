import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
  ) {}

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        passwordHash: true,
        isActive: true,
      },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.passwords.verify(
      user.passwordHash,
      password,
    );

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.sessions.create(user.id);
  }

  async logout(token: string): Promise<void> {
    await this.sessions.revoke(token);
  }

  async me(token: string) {
    const user = await this.sessions.validate(token);

    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }

    return user;
  }
}
