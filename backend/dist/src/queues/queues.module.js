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
const database_module_1 = require("../database/database.module");
const queue_constants_1 = require("./queue.constants");
const queues_service_1 = require("./queues.service");
const logger = new common_1.Logger('QueuesModule');
let QueuesModule = class QueuesModule {
};
exports.QueuesModule = QueuesModule;
exports.QueuesModule = QueuesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            database_module_1.DatabaseModule,
            bullmq_1.BullModule.forRootAsync({
                imports: [config_1.ConfigModule],
                inject: [config_1.ConfigService],
                useFactory: async (config) => {
                    const nodeEnv = config.get('nodeEnv') || process.env.NODE_ENV || 'development';
                    const isProd = nodeEnv === 'production';
                    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
                    const configuredRedisUrl = (process.env.REDIS_URL ||
                        config.get('redis.url') ||
                        '').trim();
                    if (isProd) {
                        if (!configuredRedisUrl) {
                            if (isVercel || process.env.ALLOW_REDIS_MOCK === 'true') {
                                logger.warn('REDIS_URL is not configured; BullMQ running on in-memory mock Redis. Configure managed Redis (REDIS_URL) and WorkerModule for durable background queues.');
                                return {
                                    connection: new ioredis_mock_1.default(),
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
                                retryStrategy: (times) => Math.min(times * 250, 10_000),
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
                            retryStrategy: (times) => Math.min(times * 250, 10_000),
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
            bullmq_1.BullModule.registerQueue({ name: queue_constants_1.QUEUE_AI_PROCESSING }, { name: queue_constants_1.QUEUE_MESSAGE_DELIVERY }, { name: queue_constants_1.QUEUE_EMAIL_PROCESSING }, { name: queue_constants_1.QUEUE_WEBHOOKS }, { name: queue_constants_1.QUEUE_AUTOMATIONS }, { name: queue_constants_1.QUEUE_KNOWLEDGE_INDEXING }, { name: queue_constants_1.QUEUE_NOTIFICATIONS }, { name: queue_constants_1.QUEUE_ANALYTICS }),
        ],
        providers: [queues_service_1.QueuesService],
        exports: [bullmq_1.BullModule, queues_service_1.QueuesService],
    })
], QueuesModule);
//# sourceMappingURL=queues.module.js.map