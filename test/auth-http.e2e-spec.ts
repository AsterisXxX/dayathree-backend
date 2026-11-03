import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication HTTP security', () => {
  let app: INestApplication;

  async function createTestApp(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const testApp = moduleRef.createNestApplication();
    testApp.setGlobalPrefix('api/v1');

    testApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        forbidUnknownValues: true,
      }),
    );

    await testApp.init();
    return testApp;
  }

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rejects GET /auth/me without a session', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
  });

  it('rejects POST /auth/logout without a session', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .expect(401);
  });

  it('rejects malformed login email', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'not-an-email',
        password: 'Password123!',
      })
      .expect(400);
  });

  it('rejects additional login properties', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'rider@example.invalid',
        password: 'Password123!',
        isAdmin: true,
      })
      .expect(400);
  });

  it('limits login requests to five per minute', async () => {
    const throttleApp = await createTestApp();

    try {
      for (let i = 0; i < 5; i++) {
        await request(throttleApp.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email: 'missing@example.invalid',
            password: 'WrongPassword123!',
          })
          .expect(401);
      }

      await request(throttleApp.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'missing@example.invalid',
          password: 'WrongPassword123!',
        })
        .expect(429);
    } finally {
      await throttleApp.close();
    }
  });
});
