/**
 * HttpExceptionFilter — filtro global de excepciones (JLP-013 / B4)
 *
 * Normaliza TODAS las respuestas de error a un envelope consistente:
 * {
 *   ok:          false,
 *   statusCode:  number,
 *   code:        string,   ← identificador de máquina para el cliente
 *   timestamp:   string,
 *   path:        string,
 *   message:     string,
 * }
 *
 * Códigos especiales:
 *  - VALIDATION_ERROR   → 400 con array de mensajes de class-validator
 *  - REFRESH_REUSE      → 401 enviado por AuthService cuando detecta reutilización
 *    de refresh token (el mensaje contiene la palabra "revocada")
 *  - Para el resto se deriva el código del status HTTP estándar.
 */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** Mapea HTTP status → código de máquina legible. */
const STATUS_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  408: 'REQUEST_TIMEOUT',
  409: 'CONFLICT',
  410: 'GONE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
};

function deriveCode(status: number, rawResponse: unknown): string {
  // Validación de DTOs (class-validator emite array de mensajes)
  if (
    status === 400 &&
    typeof rawResponse === 'object' &&
    rawResponse !== null &&
    Array.isArray((rawResponse as any).message)
  ) {
    return 'VALIDATION_ERROR';
  }

  // Detección de reuso de refresh token (JLP-001)
  if (
    status === 401 &&
    typeof rawResponse === 'object' &&
    rawResponse !== null &&
    typeof (rawResponse as any).message === 'string' &&
    (rawResponse as any).message.includes('revocada')
  ) {
    return 'REFRESH_REUSE';
  }

  return STATUS_CODES[status] ?? 'INTERNAL_SERVER_ERROR';
}

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

    const code = deriveCode(status, rawResponse);

    // 5xx → log con stack completo; 4xx → warning ligero
    if (status >= 500) {
      this.logger.error(
        `[${status}] ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${status}] [${code}] ${request.method} ${request.url} → ${JSON.stringify(message)}`,
      );
    }

    response.status(status).json({
      ok:         false,
      statusCode: status,
      code,
      timestamp:  new Date().toISOString(),
      path:       request.url,
      message:    Array.isArray(message) ? message.join(', ') : message,
    });
  }
}
