"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = require("ioredis");
const common_1 = require("@nestjs/common");
const cors_1 = require("../common/security/cors");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    constructor() {
        super(...arguments);
        this.adapterConstructor = null;
        this.logger = new common_1.Logger(RedisIoAdapter.name);
    }
    async connectToRedis(redisUrl) {
        const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
        const isProd = process.env.NODE_ENV === 'production';
        const url = (redisUrl || process.env.REDIS_URL || '').trim();
        if (isVercel) {
            this.logger.warn('Running on Vercel serverless: skipping Redis Socket.IO adapter initialization. Host WebSockets on a persistent Node service for live Socket.IO.');
            return;
        }
        if (!url) {
            if (isProd && process.env.ALLOW_INMEMORY_SOCKET_ADAPTER !== 'true') {
                throw new Error('REDIS_URL is required in production for multi-instance Socket.IO.');
            }
            this.logger.log('No REDIS_URL configured; using default in-memory Socket.IO adapter.');
            return;
        }
        try {
            const pubClient = new ioredis_1.default(url, {
                maxRetriesPerRequest: isProd ? null : 1,
                lazyConnect: true,
                connectTimeout: 2000,
                retryStrategy: isProd ? (times) => Math.min(times * 250, 3000) : () => null,
            });
            pubClient.on('error', (err) => {
                this.logger.error(`Socket.IO Redis pubClient error: ${err?.message || err}`);
            });
            await pubClient.connect();
            const subClient = pubClient.duplicate();
            subClient.on('error', (err) => {
                this.logger.error(`Socket.IO Redis subClient error: ${err?.message || err}`);
            });
            await subClient.connect();
            this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
            this.logger.log(`Socket.IO Redis adapter connected.`);
        }
        catch (error) {
            if (isProd && process.env.ALLOW_INMEMORY_SOCKET_ADAPTER !== 'true') {
                throw new Error(`Redis unavailable for Socket.IO in production: ${error?.message || error}`);
            }
            this.logger.log(`Redis unavailable for Socket.IO (${error?.message || error}). Running with default in-memory adapter for local dev.`);
        }
    }
    createIOServer(port, options) {
        const cors = (0, cors_1.buildCorsOptions)(process.env);
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: cors.origin,
                methods: ['GET', 'POST'],
                credentials: true,
            },
        });
        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }
        return server;
    }
}
exports.RedisIoAdapter = RedisIoAdapter;
//# sourceMappingURL=redis-io.adapter.js.map