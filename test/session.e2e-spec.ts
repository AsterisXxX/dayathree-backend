import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionService } from '../src/auth/session.service';

describe('SessionService PostgreSQL integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('validates session lifecycle against real PostgreSQL', async () => {
    const email = `auth-test-${randomUUID()}@example.invalid`;
    const rollbackMarker = 'EXPECTED_SESSION_TEST_ROLLBACK';

    await expect(
      prisma.$transaction(async (tx) => {
        const service = new SessionService(
          tx as unknown as PrismaService,
        );

        const user = await tx.user.create({
          data: {
            email,
            fullName: 'Temporary Auth Test',
            passwordHash: 'TEST_ONLY_NOT_A_REAL_HASH',
          },
        });

        const session = await service.create(user.id);

        expect(session.token).toMatch(/^[a-f0-9]{64}$/);

        const storedHash = createHash('sha256')
          .update(session.token)
          .digest('hex');

        const stored = await tx.staffSession.findUnique({
          where: { tokenHash: storedHash },
        });

        expect(stored).not.toBeNull();
        expect(stored?.tokenHash).not.toBe(session.token);

        const active = await service.validate(session.token);

        expect(active).toMatchObject({
          userId: user.id,
          email,
          fullName: 'Temporary Auth Test',
          roles: [],
        });

        await service.revoke(session.token);

        expect(await service.validate(session.token)).toBeNull();

        const expiredSession = await service.create(user.id);
        await tx.staffSession.update({
          where: {
            tokenHash: createHash('sha256')
              .update(expiredSession.token)
              .digest('hex'),
          },
          data: {
            expiresAt: new Date(Date.now() - 60_000),
          },
        });

        expect(
          await service.validate(expiredSession.token),
        ).toBeNull();

        const inactiveSession = await service.create(user.id);

        await tx.user.update({
          where: { id: user.id },
          data: { isActive: false },
        });

        expect(
          await service.validate(inactiveSession.token),
        ).toBeNull();

        await expect(service.create(user.id)).rejects.toThrow(
          UnauthorizedException,
        );

        throw new Error(rollbackMarker);
      }),
    ).rejects.toThrow(rollbackMarker);

    const remainingUser = await prisma.user.findUnique({
      where: { email },
    });

    expect(remainingUser).toBeNull();
  }, 30000);
});
