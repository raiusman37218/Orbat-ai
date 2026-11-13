import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { DatabaseModule } from '../database/database.module';
import {
  QUEUE_AI_PROCESSING,
  QUEUE_MESSAGE_DELIVERY,
  QUEUE_EMAIL_PROCESSING,
  QUEUE_WEBHOOKS,
  QUEUE_AUTOMATIONS,
  QUEUE_KNOWLEDGE_INDEXING,
  QUEUE_NOTIFICATIONS,
  QUEUE_ANALYTICS,
} from './queue.constants';
import { QueuesService } from './queues.service';

const logger = new Logger('QueuesModule');

@Module({
  imports: [
    DatabaseModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const nodeEnv = config.get<string>('nodeEnv') || process.env.NODE_ENV || 'development';
        const isProd = nodeEnv === 'production';
        const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
        const configuredRedisUrl = (
          process.env.REDIS_URL ||
          config.get<string>('redis.url') ||
          ''
        ).trim();

        if (isProd) {
          if (!configuredRedisUrl) {
            if (isVercel || process.env.ALLOW_REDIS_MOCK === 'true') {
              logger.warn(
                'REDIS_URL is not configured; BullMQ running on in-memory mock Redis. Configure managed Redis (REDIS_URL) and WorkerModule for durable background queues.',
              );
              return {
                connection: new RedisMock() as any,
              };
            }
            throw new Error('REDIS_URL must be configured for BullMQ in production.');
          }
          const url = new URL(configuredRedisUrl);
          return {
            connection: {
              host: url.hostname,
              port: parseInt(url.port || '6379', 10),
              password: url.password || undefined,
              username: url.username || undefined,
              tls: url.protocol === 'rediss:' ? {} : undefined,
              maxRetriesPerRequest: null,
              enableReadyCheck: true,
              connectTimeout: isVercel ? 3500 : 10000,
              retryStrategy: (times: number) => Math.min(times * 250, 10_000),
            },
            defaultJobOptions: {
              attempts: 3,
              backoff: { type: 'exponential', delay: 2000 },
              removeOnComplete: { count: 1000, age: 3600 },
              removeOnFail: { count: 5000, age: 86400 },
            },
          };
        }

        const redisUrl = configuredRedisUrl || 'redis://localhost:6379';
        const url = new URL(redisUrl);

        let isLiveRedis = false;
        try {
          const testClient = new Redis(redisUrl, {
            lazyConnect: true,
            connectTimeout: 800,
            maxRetriesPerRequest: 1,
            retryStrategy: () => null,
          });
          testClient.on('error', () => {});
          await testClient.connect();
          isLiveRedis = true;
          await testClient.quit();
        } catch {
          isLiveRedis = false;
        }

        if (!isLiveRedis) {
          logger.log(
            'Redis daemon not detected; BullMQ running on in-memory mock Redis for local development.',
          );
          return {
            connection: new RedisMock() as any,
          };
        }

        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port || '6379', 10),
            password: url.password || undefined,
            username: url.username || undefined,
            tls: url.protocol === 'rediss:' ? {} : undefined,
            maxRetriesPerRequest: null,
            retryStrategy: (times: number) => Math.min(times * 250, 10_000),
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: { count: 1000, age: 3600 },
            removeOnFail: { count: 5000, age: 86400 },
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_AI_PROCESSING },
      { name: QUEUE_MESSAGE_DELIVERY },
      { name: QUEUE_EMAIL_PROCESSING },
      { name: QUEUE_WEBHOOKS },
      { name: QUEUE_AUTOMATIONS },
      { name: QUEUE_KNOWLEDGE_INDEXING },
      { name: QUEUE_NOTIFICATIONS },
      { name: QUEUE_ANALYTICS },
    ),
  ],
  providers: [QueuesService],
  exports: [BullModule, QueuesService],
})
export class QueuesModule {}
