import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async create(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });

    if (!user?.isActive) {
      throw new UnauthorizedException('Invalid staff account');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await this.prisma.staffSession.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  async validate(token: string) {
    if (!TOKEN_PATTERN.test(token)) {
      return null;
    }

    const session = await this.prisma.staffSession.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { isActive: true },
      },
      select: {
        id: true,
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            roles: {
              select: {
                role: {
                  select: { code: true },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      userId: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      roles: session.user.roles.map((item) => item.role.code),
    };
  }

  async revoke(token: string): Promise<void> {
    if (!TOKEN_PATTERN.test(token)) {
      return;
    }

    await this.prisma.staffSession.updateMany({
      where: {
        tokenHash: this.hashToken(token),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
