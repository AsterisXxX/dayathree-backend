import {
  Controller,
  Get,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { AuthModule } from '../src/auth/auth.module';
import { PasswordService } from '../src/auth/password.service';
import { STAFF_ROLES } from '../src/auth/roles.decorator';
import { StaffRoles } from '../src/auth/staff-roles.decorator';
import { PrismaService } from '../src/prisma/prisma.service';

@Controller('rbac-test')
class RbacTestController {
  @Get('rider')
  @StaffRoles(STAFF_ROLES.RIDER)
  rider() {
    return { access: 'rider' };
  }

  @Get('checker')
  @StaffRoles(STAFF_ROLES.CHECKER)
  checker() {
    return { access: 'checker' };
  }
}

describe('HTTP RBAC integration', () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('enforces roles and reflects database role changes', async () => {
    const email = `rbac-${randomUUID()}@example.invalid`;
    const password = 'TemporaryRbacPassword123!';
    const rollbackMarker = 'EXPECTED_RBAC_ROLLBACK';
    let completed = false;

    try {
      await prisma.$transaction(
        async (tx) => {
          const moduleRef = await Test.createTestingModule({
            imports: [AppModule, AuthModule],
            controllers: [RbacTestController],
          })
            .overrideProvider(PrismaService)
            .useValue(tx)
            .compile();

          let app: INestApplication | undefined;

          try {
            app = moduleRef.createNestApplication();
            app.setGlobalPrefix('api/v1');
            await app.init();

            const passwords = app.get(PasswordService);

            const riderRole = await tx.role.upsert({
              where: { code: 'RIDER' },
              update: {},
              create: {
                code: 'RIDER',
                name: 'Rider',
              },
            });

            const checkerRole = await tx.role.upsert({
              where: { code: 'CHECKER' },
              update: {},
              create: {
                code: 'CHECKER',
                name: 'Checker',
              },
            });

            const user = await tx.user.create({
              data: {
                email,
                fullName: 'Temporary RBAC Test',
                passwordHash: await passwords.hash(password),
              },
            });

            await tx.userRole.create({
              data: {
                userId: user.id,
                roleId: riderRole.id,
              },
            });

            const server = app.getHttpServer();

            // Login sebagai RIDER.
            const login = await request(server)
              .post('/api/v1/auth/login')
              .send({ email, password })
              .expect(201);

            const token: unknown = login.body.data?.token;
            expect(token).toMatch(/^[a-f0-9]{64}$/);

            if (typeof token !== 'string') {
              throw new Error('RBAC_TOKEN_MISSING');
            }

            const authorization = `Bearer ${token}`;

            // RIDER boleh mengakses route Rider.
            await request(server)
              .get('/api/v1/rbac-test/rider')
              .set('Authorization', authorization)
              .expect(200);

            // RIDER tidak boleh mengakses route Checker.
            await request(server)
              .get('/api/v1/rbac-test/checker')
              .set('Authorization', authorization)
              .expect(403);

            // Tanpa token harus ditolak.
            await request(server)
              .get('/api/v1/rbac-test/rider')
              .expect(401);

            // Ubah RIDER menjadi CHECKER di PostgreSQL.
            await tx.userRole.deleteMany({
              where: { userId: user.id },
            });

            await tx.userRole.create({
              data: {
                userId: user.id,
                roleId: checkerRole.id,
              },
            });

            // Token sama, role terbaru harus berlaku.
            await request(server)
              .get('/api/v1/rbac-test/rider')
              .set('Authorization', authorization)
              .expect(403);

            await request(server)
              .get('/api/v1/rbac-test/checker')
              .set('Authorization', authorization)
              .expect(200);

            // Cabut seluruh role.
            await tx.userRole.deleteMany({
              where: { userId: user.id },
            });

            // User valid tanpa role tetap tidak berizin.
            await request(server)
              .get('/api/v1/rbac-test/checker')
              .set('Authorization', authorization)
              .expect(403);

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
        error.message !== 'EXPECTED_RBAC_ROLLBACK'
      ) {
        throw error;
      }
    }

    expect(completed).toBe(true);

    // Akun sementara tidak boleh tersimpan permanen.
    expect(
      await prisma.user.findUnique({
        where: { email },
      }),
    ).toBeNull();
  }, 40000);
});
