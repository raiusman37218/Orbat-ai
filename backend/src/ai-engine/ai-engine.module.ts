import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { AiEngineController } from './ai-engine.controller';
import { AiEngineService } from './ai-engine.service';
import { AiUsageService } from './ai-usage.service';
import { HybridRetrievalService } from './retrieval/hybrid-retrieval.service';
import { LLM_PROVIDER } from './interfaces/llm-provider.interface';
import { MockFallbackProvider } from './providers/mock-fallback.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { AnthropicProvider } from './providers/anthropic.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiCompatibleProvider } from './providers/openai-compatible.provider';
import { AiGatewayProvider } from './providers/ai-gateway.provider';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    forwardRef(() => MessagesModule),
    forwardRef(() => ConversationsModule),
  ],
  controllers: [AiEngineController],
  providers: [
    AiEngineService,
    AiUsageService,
    HybridRetrievalService,
    MockFallbackProvider,
    OpenAiProvider,
    AnthropicProvider,
    GeminiProvider,
    OpenAiCompatibleProvider,
    AiGatewayProvider,
    {
      provide: LLM_PROVIDER,
      useExisting: AiGatewayProvider,
    },
  ],
  exports: [AiEngineService, AiUsageService, HybridRetrievalService, LLM_PROVIDER],
})
export class AiEngineModule {}

