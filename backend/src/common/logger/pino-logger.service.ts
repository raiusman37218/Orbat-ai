import { LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';

export class PinoLoggerService implements LoggerService {
  private readonly logger: Logger;

  constructor() {
    const isProd = process.env.NODE_ENV === 'production';
    const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

    this.logger = pino({
      level,
      redact: {
        paths: [
          'password',
          'password_hash',
          'apiKey',
          'api_key',
          'token',
          'accessToken',
          'refreshToken',
          'secret',
          'headers.authorization',
          'headers.cookie',
          '*.password',
          '*.apiKey',
          '*.api_key',
          '*.token',
          '*.secret',
        ],
        censor: '[REDACTED]',
      },
      ...(isProd
        ? {}
        : {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true, singleLine: true },
            },
          }),
    });
  }

  log(message: any, context?: string) {
    this.logger.info({ context }, this.stringify(message));
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error({ context, trace }, this.stringify(message));
  }

  warn(message: any, context?: string) {
    this.logger.warn({ context }, this.stringify(message));
  }

  debug(message: any, context?: string) {
    this.logger.debug({ context }, this.stringify(message));
  }

  verbose(message: any, context?: string) {
    this.logger.trace({ context }, this.stringify(message));
  }

  private stringify(message: any): string {
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}

