"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureBackendApp = configureBackendApp;
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const worker_module_1 = require("./worker.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const logging_interceptor_1 = require("./common/interceptors/logging.interceptor");
const transform_interceptor_1 = require("./common/interceptors/transform.interceptor");
const redis_io_adapter_1 = require("./realtime/redis-io.adapter");
const pino_logger_service_1 = require("./common/logger/pino-logger.service");
const cors_1 = require("./common/security/cors");
async function configureBackendApp(app, pinoLogger) {
    app.enableShutdownHooks();
    const configService = app.get(config_1.ConfigService);
    const nodeEnv = configService.get('nodeEnv') || 'development';
    const isVercel = configService.get('isVercel') ?? (process.env.VERCEL === '1' || process.env.VERCEL === 'true');
    app.setGlobalPrefix('api/v1', {
        exclude: [{ path: '/', method: common_1.RequestMethod.GET }],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalInterceptors(new logging_interceptor_1.LoggingInterceptor(), new transform_interceptor_1.TransformInterceptor());
    const cors = (0, cors_1.buildCorsOptions)(process.env);
    if (nodeEnv === 'production' &&
        !cors.allowlist.allowAllInDev &&
        cors.allowlist.exactOrigins.size === 0 &&
        cors.allowlist.wildcardPatterns.length === 0) {
        pinoLogger.warn('CORS_ORIGIN / FRONTEND_URL is not configured; cross-origin browser requests will be rejected in production.', 'CORS');
    }
    app.enableCors({
        origin: cors.origin,
        methods: cors.methods,
        allowedHeaders: cors.allowedHeaders,
        credentials: cors.credentials,
        optionsSuccessStatus: cors.optionsSuccessStatus,
    });
    if (!isVercel) {
        const redisAdapter = new redis_io_adapter_1.RedisIoAdapter(app);
        await redisAdapter.connectToRedis(configService.get('redis.url'));
        app.useWebSocketAdapter(redisAdapter);
    }
    if (nodeEnv !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
        const swaggerConfig = new swagger_1.DocumentBuilder()
            .setTitle('Orbat AI — Enterprise Backend API')
            .setDescription('Enterprise Customer Support SaaS API powered by NestJS')
            .setVersion('1.0')
            .addBearerAuth()
            .addTag('Authentication')
            .addTag('Health')
            .build();
        const document = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
        swagger_1.SwaggerModule.setup('docs', app, document);
    }
}
async function bootstrap() {
    const pinoLogger = new pino_logger_service_1.PinoLoggerService();
    if (process.env.IS_WORKER === 'true') {
        const workerApp = await core_1.NestFactory.createApplicationContext(worker_module_1.WorkerModule, {
            logger: pinoLogger,
        });
        workerApp.enableShutdownHooks();
        pinoLogger.log('Orbat AI BullMQ Worker process started (headless)', 'WorkerBootstrap');
        return;
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: pinoLogger,
    });
    await configureBackendApp(app, pinoLogger);
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('port') || 4000;
    await app.listen(port);
    pinoLogger.log(`Orbat AI Backend running on: http://localhost:${port}/api/v1`, 'Bootstrap');
}
if (require.main === module) {
    bootstrap();
}
//# sourceMappingURL=main.js.map