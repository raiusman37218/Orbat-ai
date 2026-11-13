import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Public()
@Controller()
export class RootController {
  @Get()
  @ApiOperation({ summary: 'Backend service root status' })
  getRoot() {
    return {
      service: 'orbat-ai-backend',
      status: 'ok',
      apiBase: '/api/v1',
      health: '/api/v1/health',
      realtime: process.env.VERCEL === '1' || process.env.VERCEL === 'true' ? 'http_polling' : 'socketio',
    };
  }
}

