import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AiEngineModule } from '../ai-engine/ai-engine.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { QueuesModule } from './queues.module';
import { AiProcessor } from './processors/ai.processor';
import { MessageDeliveryProcessor } from './processors/message-delivery.processor';
import { EmailProcessingProcessor } from './processors/email-processing.processor';
import { WebhooksProcessor } from './processors/webhooks.processor';
import { AutomationsProcessor } from './processors/automations.processor';
import { KnowledgeIndexingProcessor } from './processors/knowledge-indexing.processor';
import { NotificationsProcessor } from './processors/notifications.processor';
import { AnalyticsProcessor } from './processors/analytics.processor';

@Module({
  imports: [
    DatabaseModule,
    QueuesModule,
    AiEngineModule,
    RealtimeModule,
  ],
  providers: [
    AiProcessor,
    MessageDeliveryProcessor,
    EmailProcessingProcessor,
    WebhooksProcessor,
    AutomationsProcessor,
    KnowledgeIndexingProcessor,
    NotificationsProcessor,
    AnalyticsProcessor,
  ],
})
export class QueuesWorkersModule {}

