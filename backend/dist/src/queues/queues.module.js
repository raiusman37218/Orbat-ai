"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueuesModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const config_1 = require("@nestjs/config");
const ioredis_1 = require("ioredis");
const ioredis_mock_1 = require("ioredis-mock");
const queue_constants_1 = require("./queue.constants");
const queues_service_1 = require("./queues.service");
const ai_processor_1 = require("./processors/ai.processor");
const notifications_processor_1 = require("./processors/notifications.processor");
const automations_processor_1 = require("./processors/automations.processor");
const webhooks_processor_1 = require("./processors/webhooks.processor");
const logger = new common_1.Logger('QueuesModule');
let QueuesModule = class QueuesModule {
};
exports.QueuesModule = QueuesModule;
exports.QueuesModule = QueuesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: async (config) => {
                    const redisUrl = config.get('redis.url') || 'redis://localhost:6379';
                    const url = new URL(redisUrl);
                    let isLiveRedis = false;
                    try {
                        const testClient = new ioredis_1.default(redisUrl, {
                            lazyConnect: true,
                            connectTimeout: 800,
                            maxRetriesPerRequest: 1,
                            retryStrategy: () => null,
                        });
                        testClient.on('error', () => { });
                        await testClient.connect();
                        isLiveRedis = true;
                        await testClient.quit();
                    }
                    catch {
                        isLiveRedis = false;
                    }
                    if (!isLiveRedis) {
                        logger.log('Redis daemon not detected; BullMQ running on in-memory mock Redis for local development.');
                        return {
                            connection: new ioredis_mock_1.default(),
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
            bullmq_1.BullModule.registerQueue({ name: queue_constants_1.QUEUE_AI_PROCESSING }, { name: queue_constants_1.QUEUE_NOTIFICATIONS }, { name: queue_constants_1.QUEUE_AUTOMATIONS }, { name: queue_constants_1.QUEUE_WEBHOOKS }),
        ],
        providers: [
            queues_service_1.QueuesService,
            ai_processor_1.AiProcessor,
            notifications_processor_1.NotificationsProcessor,
            automations_processor_1.AutomationsProcessor,
            webhooks_processor_1.WebhooksProcessor,
        ],
        exports: [bullmq_1.BullModule, queues_service_1.QueuesService],
    })
], QueuesModule);
//# sourceMappingURL=queues.module.js.map