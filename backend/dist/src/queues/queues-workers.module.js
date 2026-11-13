"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueuesWorkersModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../database/database.module");
const ai_engine_module_1 = require("../ai-engine/ai-engine.module");
const realtime_module_1 = require("../realtime/realtime.module");
const queues_module_1 = require("./queues.module");
const ai_processor_1 = require("./processors/ai.processor");
const message_delivery_processor_1 = require("./processors/message-delivery.processor");
const email_processing_processor_1 = require("./processors/email-processing.processor");
const webhooks_processor_1 = require("./processors/webhooks.processor");
const automations_processor_1 = require("./processors/automations.processor");
const knowledge_indexing_processor_1 = require("./processors/knowledge-indexing.processor");
const notifications_processor_1 = require("./processors/notifications.processor");
const analytics_processor_1 = require("./processors/analytics.processor");
let QueuesWorkersModule = class QueuesWorkersModule {
};
exports.QueuesWorkersModule = QueuesWorkersModule;
exports.QueuesWorkersModule = QueuesWorkersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            queues_module_1.QueuesModule,
            ai_engine_module_1.AiEngineModule,
            realtime_module_1.RealtimeModule,
        ],
        providers: [
            ai_processor_1.AiProcessor,
            message_delivery_processor_1.MessageDeliveryProcessor,
            email_processing_processor_1.EmailProcessingProcessor,
            webhooks_processor_1.WebhooksProcessor,
            automations_processor_1.AutomationsProcessor,
            knowledge_indexing_processor_1.KnowledgeIndexingProcessor,
            notifications_processor_1.NotificationsProcessor,
            analytics_processor_1.AnalyticsProcessor,
        ],
    })
], QueuesWorkersModule);
//# sourceMappingURL=queues-workers.module.js.map