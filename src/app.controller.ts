import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('System')
@Controller()
export class AppController {
  @Get('health')
  @ApiOperation({ summary: 'Check backend service health' })
  getHealth() {
    return {
      data: {
        status: 'ok',
        service: 'dayathree-backend',
      },
    };
  }
}