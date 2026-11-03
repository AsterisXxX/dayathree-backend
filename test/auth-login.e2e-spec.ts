import { UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { AuthModule } from '../src/auth/auth.module';
import { AuthService } from '../src/auth/auth.service';
import { PasswordService } from '../src/auth/password.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuthService PostgreSQL integration', () => {
  const prisma = new PrismaClient();
  const rollbackMarker = 'EXPECTED_AUTH_TEST_ROLLBACK';

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('handles real password login and session lifecycle', async () => {
    const email = `auth-login-${randomUUID()}@example.invalid`;
    let completed = false;

    try {
      await prisma.$transaction(
        async (tx) => {
          const moduleRef = await Test.createTestingModule({
            imports: [AuthModule],
          })
            .overrideProvider(PrismaService)
            .useValue(tx)
            .compile();

          try {
            const auth = moduleRef.get(AuthService);
            const passwords = moduleRef.get(PasswordService);
            const password = 'TemporaryTestPassword123!';

            const user = await tx.user.create({
              data: {
                email,
                fullName: 'Temporary Auth Login Test',
                passwordHash: await passwords.hash(password),
              },
            });

            const session = await auth.login(
              `  ${email.toUpperCase()}  `,
              password,
            );

            expect(session.token).toMatch(/^[a-f0-9]{64}$/);

            const identity = await auth.me(session.token);

            expect(identity).toMatchObject({
              userId: user.id,
              email,
              roles: [],
            });

            await expect(
              auth.login(email, 'WrongPassword123!'),
            ).rejects.toThrow(UnauthorizedException);

            await expect(
              auth.login('missing@example.invalid', password),
            ).rejects.toThrow(UnauthorizedException);

            await auth.logout(session.token);

            await expect(
              auth.me(session.token),
            ).rejects.toThrow(UnauthorizedException);

            const secondSession = await auth.login(email, password);

            await tx.user.update({
              where: { id: user.id },
              data: { isActive: false },
            });

            await expect(
              auth.me(secondSession.token),
            ).rejects.toThrow(UnauthorizedException);

            await expect(
              auth.login(email, password),
            ).rejects.toThrow(UnauthorizedException);

            completed = true;
          } finally {
            await moduleRef.close();
          }

          throw new Error(rollbackMarker);
        },
        { maxWait: 10000, timeout: 15000 },
      );
    } catch (error) {
      if (
        !(error instanceof Error) ||
        error.message !== rollbackMarker
      ) {
        throw error;
      }
    }

    expect(completed).toBe(true);

    expect(
      await prisma.user.findUnique({
        where: { email },
      }),
    ).toBeNull();
  }, 30000);
});
