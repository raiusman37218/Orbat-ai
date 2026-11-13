import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'Internal server error';
    let errorDetails: any = null;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const respObj = exceptionResponse as Record<string, any>;
      message = respObj.message || respObj.error || message;
      errorDetails = respObj.details || (Array.isArray(respObj.message) ? respObj.message : null);
    } else if (exception instanceof Error) {
      // In production, do not leak raw unhandled error messages
      message = process.env.NODE_ENV === 'production' && status === 500
        ? 'Internal server error'
        : exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Error: ${exception instanceof Error ? exception.stack : JSON.stringify(exception)}`
      );
    } else {
      this.logger.warn(`[${request.method}] ${request.url} - Status ${status}: ${message}`);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      ...(errorDetails && { details: errorDetails }),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

