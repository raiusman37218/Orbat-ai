"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PinoLoggerService = void 0;
const pino_1 = require("pino");
class PinoLoggerService {
    constructor() {
        const isProd = process.env.NODE_ENV === 'production';
        const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');
        this.logger = (0, pino_1.default)({
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
    log(message, context) {
        this.logger.info({ context }, this.stringify(message));
    }
    error(message, trace, context) {
        this.logger.error({ context, trace }, this.stringify(message));
    }
    warn(message, context) {
        this.logger.warn({ context }, this.stringify(message));
    }
    debug(message, context) {
        this.logger.debug({ context }, this.stringify(message));
    }
    verbose(message, context) {
        this.logger.trace({ context }, this.stringify(message));
    }
    stringify(message) {
        if (typeof message === 'string')
            return message;
        try {
            return JSON.stringify(message);
        }
        catch {
            return String(message);
        }
    }
}
exports.PinoLoggerService = PinoLoggerService;
//# sourceMappingURL=pino-logger.service.js.map