import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  constructor(private readonly db: DatabaseService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'System health check and database connectivity' })
  @ApiResponse({ status: 200, description: 'System health metrics returned.' })
  async check() {
    const dbPing = await this.db.ping();
    const memory = process.memoryUsage();

    return {
      status: dbPing.ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      database: {
        connected: dbPing.ok,
        latencyMs: dbPing.latencyMs,
        ...(dbPing.error && { error: dbPing.error }),
      },
      system: {
        nodeVersion: process.version,
        memoryRssMb: Math.round(memory.rss / 1024 / 1024),
        memoryHeapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      },
    };
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for container orchestration' })
  liveness() {
    return { status: 'alive' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe for traffic routing' })
  async readiness() {
    const dbPing = await this.db.ping();
    if (!dbPing.ok) {
      return { status: 'not_ready', database: dbPing.error };
    }
    return { status: 'ready', database: 'connected' };
  }
}

