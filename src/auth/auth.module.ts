import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

@Module({
  imports: [PrismaModule],
  providers: [AuthService, PasswordService, SessionService],
  exports: [AuthService, PasswordService, SessionService],
})
export class AuthModule {}
