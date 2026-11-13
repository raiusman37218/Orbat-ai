import { Module, Logger } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import {
  QUEUE_AI_PROCESSING,
  QUEUE_NOTIFICATIONS,
  QUEUE_AUTOMATIONS,
  QUEUE_WEBHOOKS,
} from './queue.constants';
import { QueuesService } from './queues.service';
import { AiProcessor } from './processors/ai.processor';
import { NotificationsProcessor } from './processors/notifications.processor';
import { AutomationsProcessor } from './processors/automations.processor';
import { WebhooksProcessor } from './processors/webhooks.processor';

const logger = new Logger('QueuesModule');

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const redisUrl = config.get<string>('redis.url') || 'redis://localhost:6379';
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
      { name: QUEUE_NOTIFICATIONS },
      { name: QUEUE_AUTOMATIONS },
      { name: QUEUE_WEBHOOKS },
    ),
  ],
  providers: [
    QueuesService,
    AiProcessor,
    NotificationsProcessor,
    AutomationsProcessor,
    WebhooksProcessor,
  ],
  exports: [BullModule, QueuesService],
})
export class QueuesModule {}
