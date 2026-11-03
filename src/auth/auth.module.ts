import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionGuard } from './session.guard';
import { SessionService } from './session.service';

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([
      {
        name: 'login',
        ttl: 60000,
        limit: 5,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    SessionGuard,
  ],
  exports: [
    AuthService,
    PasswordService,
    SessionService,
    SessionGuard,
  ],
})
export class AuthModule {}
