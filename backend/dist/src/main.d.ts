import { type INestApplication } from '@nestjs/common';
import { PinoLoggerService } from './common/logger/pino-logger.service';
export declare function configureBackendApp(app: INestApplication, pinoLogger: PinoLoggerService): Promise<void>;
