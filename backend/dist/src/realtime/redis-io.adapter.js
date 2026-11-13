"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisIoAdapter = void 0;
const platform_socket_io_1 = require("@nestjs/platform-socket.io");
const redis_adapter_1 = require("@socket.io/redis-adapter");
const ioredis_1 = require("ioredis");
const common_1 = require("@nestjs/common");
class RedisIoAdapter extends platform_socket_io_1.IoAdapter {
    constructor() {
        super(...arguments);
        this.adapterConstructor = null;
        this.logger = new common_1.Logger(RedisIoAdapter.name);
    }
    async connectToRedis(redisUrl) {
        const url = redisUrl || process.env.REDIS_URL;
        if (!url) {
            this.logger.log('No REDIS_URL configured; using default in-memory Socket.IO adapter.');
            return;
        }
        try {
            const pubClient = new ioredis_1.default(url, {
                maxRetriesPerRequest: 1,
                lazyConnect: true,
                connectTimeout: 1000,
                retryStrategy: () => null,
            });
            pubClient.on('error', () => { });
            await pubClient.connect();
            const subClient = pubClient.duplicate();
            subClient.on('error', () => { });
            await subClient.connect();
            this.adapterConstructor = (0, redis_adapter_1.createAdapter)(pubClient, subClient);
            this.logger.log(`Socket.IO Redis adapter connected.`);
        }
        catch (error) {
            this.logger.log(`Redis unavailable for Socket.IO (${error?.message || error}). Running with default in-memory adapter for local dev.`);
        }
    }
    createIOServer(port, options) {
        const server = super.createIOServer(port, {
            ...options,
            cors: {
                origin: '*',
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