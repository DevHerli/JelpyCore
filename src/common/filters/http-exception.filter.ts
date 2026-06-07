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
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    // Normaliza el mensaje: puede ser string, array (class-validator) u objeto
    const message =
      rawResponse == null
        ? 'Error interno del servidor'
        : typeof rawResponse === 'object' && 'message' in (rawResponse as object)
          ? (rawResponse as any).message
          : rawResponse;

    // Loguea 5xx con stack completo; 4xx sólo como warning
    if (status >= 500) {
      this.logger.error(
        `[${status}] ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${status}] ${request.method} ${request.url} → ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json({
      ok:          false,
      statusCode:  status,
      timestamp:   new Date().toISOString(),
      path:        request.url,
      message:     Array.isArray(message) ? message.join(', ') : message,
    });
  }
}
