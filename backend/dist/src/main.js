"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const logging_interceptor_1 = require("./common/interceptors/logging.interceptor");
const transform_interceptor_1 = require("./common/interceptors/transform.interceptor");
const redis_io_adapter_1 = require("./realtime/redis-io.adapter");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger: ['error', 'warn', 'log'],
    });
    const configService = app.get(config_1.ConfigService);
    const port = configService.get('port') || 4000;
    const corsOrigin = configService.get('corsOrigin') || '*';
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalInterceptors(new logging_interceptor_1.LoggingInterceptor(), new transform_interceptor_1.TransformInterceptor());
    app.enableCors({
        origin: corsOrigin === '*' ? true : corsOrigin.split(','),
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
    });
    const redisAdapter = new redis_io_adapter_1.RedisIoAdapter(app);
    await redisAdapter.connectToRedis(configService.get('redis.url'));
    app.useWebSocketAdapter(redisAdapter);
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
    await app.listen(port);
    logger.log(`🚀 Orbat AI Backend running on: http://localhost:${port}/api/v1`);
    logger.log(`📚 Swagger documentation available at: http://localhost:${port}/docs`);
}
bootstrap();
//# sourceMappingURL=main.js.map