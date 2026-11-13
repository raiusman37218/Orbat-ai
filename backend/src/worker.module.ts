import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { RealtimeModule } from './realtime/realtime.module';
import { QueuesModule } from './queues/queues.module';
import { QueuesWorkersModule } from './queues/queues-workers.module';
import { AiEngineModule } from './ai-engine/ai-engine.module';

/**
 * Headless BullMQ background worker entrypoint module (booted when IS_WORKER=true).
 * Excludes HTTP/Swagger listeners so long-running jobs never block API traffic.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      ignoreEnvFile: process.env.VERCEL === '1' || process.env.VERCEL === 'true',
      envFilePath: ['.env', '.env.local'],
    }),
    DatabaseModule,
    AuthModule,
    ConversationsModule,
    MessagesModule,
    RealtimeModule,
    QueuesModule,
    AiEngineModule,
    QueuesWorkersModule,
  ],
})
export class WorkerModule {}

