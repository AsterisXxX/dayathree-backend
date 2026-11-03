import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AuthModule } from './auth.module';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

describe('AuthModule', () => {
  it('provides PasswordService and SessionService through NestJS DI', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    try {
      expect(moduleRef.get(PasswordService)).toBeInstanceOf(PasswordService);
      expect(moduleRef.get(SessionService)).toBeInstanceOf(SessionService);
    } finally {
      await moduleRef.close();
    }
  });
});
