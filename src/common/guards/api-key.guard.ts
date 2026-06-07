import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard de API Key para endpoints llamados desde Jelpy Admin.
 * Verifica el header: X-API-Key: <JELPY_INTERNAL_API_KEY>
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request  = context.switchToHttp().getRequest();
    const incoming = request.headers['x-api-key'] as string | undefined;
    const expected = this.config.get<string>('JELPY_INTERNAL_API_KEY');

    if (!expected) {
      throw new UnauthorizedException('API Key no configurada en el servidor');
    }

    if (!incoming || incoming !== expected) {
      throw new UnauthorizedException('API Key inválida o ausente');
    }

    return true;
  }
}
