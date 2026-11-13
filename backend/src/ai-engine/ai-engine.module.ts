import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
    {
      provide: LLM_PROVIDER,
      inject: [ConfigService, OpenAiProvider, AnthropicProvider, MockFallbackProvider],
      useFactory: (
        config: ConfigService,
        openAi: OpenAiProvider,
        anthropic: AnthropicProvider,
        mock: MockFallbackProvider,
      ) => {
        if (config.get<string>('OPENAI_API_KEY') || process.env.OPENAI_API_KEY) {
          return openAi;
        }
        if (config.get<string>('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY) {
          return anthropic;
        }
        return mock;
      },
    },
  ],
  exports: [AiEngineService, AiUsageService, LLM_PROVIDER],
})
export class AiEngineModule {}

