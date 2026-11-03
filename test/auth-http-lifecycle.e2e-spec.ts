import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PasswordService } from '../src/auth/password.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Authentication HTTP lifecycle', () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('logs in, authenticates, logs out and revokes token', async () => {
    const email = `http-auth-${randomUUID()}@example.invalid`;
    const password = 'TemporaryTestPassword123!';
    const rollbackMarker = 'EXPECTED_HTTP_AUTH_ROLLBACK';
    let completed = false;

    try {
      await prisma.$transaction(
        async (tx) => {
          const moduleRef = await Test.createTestingModule({
            imports: [AppModule],
          })
            .overrideProvider(PrismaService)
            .useValue(tx)
            .compile();

          let app: INestApplication | undefined;

          try {
            app = moduleRef.createNestApplication();
            app.setGlobalPrefix('api/v1');

            app.useGlobalPipes(
              new ValidationPipe({
                whitelist: true,
                forbidNonWhitelisted: true,
                transform: true,
                forbidUnknownValues: true,
              }),
            );

            await app.init();

            const passwords = app.get(PasswordService);

            const user = await tx.user.create({
              data: {
                email,
                fullName: 'Temporary HTTP Auth Test',
                passwordHash: await passwords.hash(password),
              },
            });

            const server = app.getHttpServer();

            const login = await request(server)
              .post('/api/v1/auth/login')
              .send({
                email: `  ${email.toUpperCase()}  `,
                password,
              })
              .expect(201);

            const token: unknown = login.body.data?.token;

            expect(typeof token).toBe('string');
            expect(token).toMatch(/^[a-f0-9]{64}$/);

            if (typeof token !== 'string') {
              throw new Error('SESSION_TOKEN_MISSING');
            }

            const tokenHash = createHash('sha256')
              .update(token)
              .digest('hex');

            const stored = await tx.staffSession.findUnique({
              where: { tokenHash },
            });

            expect(stored).not.toBeNull();
            expect(stored?.userId).toBe(user.id);
            expect(stored?.tokenHash).not.toBe(token);

            const me = await request(server)
              .get('/api/v1/auth/me')
              .set('Authorization', `Bearer ${token}`)
              .expect(200);

            expect(me.body.data).toMatchObject({
              userId: user.id,
              email,
              fullName: 'Temporary HTTP Auth Test',
              roles: [],
            });

            expect(me.body.data).not.toHaveProperty('passwordHash');
            expect(me.body.data).not.toHaveProperty('token');

            await request(server)
              .post('/api/v1/auth/logout')
              .set('Authorization', `Bearer ${token}`)
              .expect(201)
              .expect((response) => {
                expect(response.body.data).toEqual({
                  success: true,
                });
              });

            await request(server)
              .get('/api/v1/auth/me')
              .set('Authorization', `Bearer ${token}`)
              .expect(401);

            const revoked = await tx.staffSession.findUnique({
              where: { tokenHash },
            });

            expect(revoked?.revokedAt).not.toBeNull();

            completed = true;
          } finally {
            if (app) {
              await app.close();
            } else {
              await moduleRef.close();
            }
          }

          throw new Error(rollbackMarker);
        },
        { maxWait: 10000, timeout: 20000 },
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
  }, 40000);
});
