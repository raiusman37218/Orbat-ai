import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private readonly logger = new Logger(RedisIoAdapter.name);

  async connectToRedis(redisUrl?: string): Promise<void> {
    const url = redisUrl || process.env.REDIS_URL;
    if (!url) {
      this.logger.log('No REDIS_URL configured; using default in-memory Socket.IO adapter.');
      return;
    }

    try {
      const pubClient = new Redis(url, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        connectTimeout: 1000,
        retryStrategy: () => null,
      });
      pubClient.on('error', () => {});

      await pubClient.connect();

      const subClient = pubClient.duplicate();
      subClient.on('error', () => {});
      await subClient.connect();

      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log(`Socket.IO Redis adapter connected.`);
    } catch (error: any) {
      this.logger.log(
        `Redis unavailable for Socket.IO (${error?.message || error}). Running with default in-memory adapter for local dev.`,
      );
    }
  }

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
