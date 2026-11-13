import { NestFactory } from '@nestjs/core';
import { RequestMethod, ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { WorkerModule } from './worker.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { RedisIoAdapter } from './realtime/redis-io.adapter';
import { PinoLoggerService } from './common/logger/pino-logger.service';
import { buildCorsOptions } from './common/security/cors';

export async function configureBackendApp(
  app: INestApplication,
  pinoLogger: PinoLoggerService,
): Promise<void> {
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('nodeEnv') || 'development';
  const isVercel = configService.get<boolean>('isVercel') ?? (process.env.VERCEL === '1' || process.env.VERCEL === 'true');

  // Keep root `/` reachable on separate Vercel backend deployments while scoping API under `/api/v1`
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // Enable CORS with normalized allowlist + wildcard subdomain support
  const cors = buildCorsOptions(process.env);
  if (
    nodeEnv === 'production' &&
    !cors.allowlist.allowAllInDev &&
    cors.allowlist.exactOrigins.size === 0 &&
    cors.allowlist.wildcardPatterns.length === 0
  ) {
    pinoLogger.warn(
      'CORS_ORIGIN / FRONTEND_URL is not configured; cross-origin browser requests will be rejected in production.',
      'CORS',
    );
  }
  app.enableCors({
    origin: cors.origin,
    methods: cors.methods,
    allowedHeaders: cors.allowedHeaders,
    credentials: cors.credentials,
    optionsSuccessStatus: cors.optionsSuccessStatus,
  });

  // Realtime Socket.IO Adapter with Redis (skipped on stateless Vercel serverless functions)
  if (!isVercel) {
    const redisAdapter = new RedisIoAdapter(app);
    await redisAdapter.connectToRedis(configService.get<string>('redis.url'));
    app.useWebSocketAdapter(redisAdapter);
  }

  // Swagger OpenAPI Documentation (disabled automatically in production unless explicitly enabled)
  if (nodeEnv !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Orbat AI — Enterprise Backend API')
      .setDescription('Enterprise Customer Support SaaS API powered by NestJS')
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('Authentication')
      .addTag('Health')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }
}

async function bootstrap() {
  const pinoLogger = new PinoLoggerService();

  if (process.env.IS_WORKER === 'true') {
    const workerApp = await NestFactory.createApplicationContext(WorkerModule, {
      logger: pinoLogger,
    });
    workerApp.enableShutdownHooks();
    pinoLogger.log('Orbat AI BullMQ Worker process started (headless)', 'WorkerBootstrap');
    return;
  }

  const app = await NestFactory.create(AppModule, {
    logger: pinoLogger,
  });
  await configureBackendApp(app, pinoLogger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 4000;

  await app.listen(port);
  pinoLogger.log(`Orbat AI Backend running on: http://localhost:${port}/api/v1`, 'Bootstrap');
}

if (require.main === module) {
  bootstrap();
}
