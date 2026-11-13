"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiEngineModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_module_1 = require("../database/database.module");
const messages_module_1 = require("../messages/messages.module");
const conversations_module_1 = require("../conversations/conversations.module");
const ai_engine_controller_1 = require("./ai-engine.controller");
const ai_engine_service_1 = require("./ai-engine.service");
const ai_usage_service_1 = require("./ai-usage.service");
const hybrid_retrieval_service_1 = require("./retrieval/hybrid-retrieval.service");
const llm_provider_interface_1 = require("./interfaces/llm-provider.interface");
const mock_fallback_provider_1 = require("./providers/mock-fallback.provider");
const openai_provider_1 = require("./providers/openai.provider");
const anthropic_provider_1 = require("./providers/anthropic.provider");
let AiEngineModule = class AiEngineModule {
};
exports.AiEngineModule = AiEngineModule;
exports.AiEngineModule = AiEngineModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            database_module_1.DatabaseModule,
            (0, common_1.forwardRef)(() => messages_module_1.MessagesModule),
            (0, common_1.forwardRef)(() => conversations_module_1.ConversationsModule),
        ],
        controllers: [ai_engine_controller_1.AiEngineController],
        providers: [
            ai_engine_service_1.AiEngineService,
            ai_usage_service_1.AiUsageService,
            hybrid_retrieval_service_1.HybridRetrievalService,
            mock_fallback_provider_1.MockFallbackProvider,
            openai_provider_1.OpenAiProvider,
            anthropic_provider_1.AnthropicProvider,
            {
                provide: llm_provider_interface_1.LLM_PROVIDER,
                inject: [config_1.ConfigService, openai_provider_1.OpenAiProvider, anthropic_provider_1.AnthropicProvider, mock_fallback_provider_1.MockFallbackProvider],
                useFactory: (config, openAi, anthropic, mock) => {
                    if (config.get('OPENAI_API_KEY') || process.env.OPENAI_API_KEY) {
                        return openAi;
                    }
                    if (config.get('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_API_KEY) {
                        return anthropic;
                    }
                    return mock;
                },
            },
        ],
        exports: [ai_engine_service_1.AiEngineService, ai_usage_service_1.AiUsageService, llm_provider_interface_1.LLM_PROVIDER],
    })
], AiEngineModule);
//# sourceMappingURL=ai-engine.module.js.map