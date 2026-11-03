import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SessionGuard } from './session.guard';
import type { AuthenticatedRequest } from './session.guard';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Log in as staff' })
  async login(@Body() dto: LoginDto) {
    const session = await this.auth.login(
      dto.email,
      dto.password,
    );

    return { data: session };
  }

  @Post('logout')
  @UseGuards(SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke current staff session' })
  async logout(@Req() request: AuthenticatedRequest) {
    await this.auth.logout(request.staffToken!);

    return { data: { success: true } };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current staff identity' })
  me(@Req() request: AuthenticatedRequest) {
    return { data: request.staff };
  }
}
