import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

/**
 * Guard JWT reutilizable para toda la aplicación.
 * Solo depende de ConfigService (globalmente disponible).
 * Extrae el Bearer token del header Authorization, lo verifica
 * con JWT_SECRET y adjunta el payload en request.user.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET no configurado en el servidor');
    }

    try {
      request.user = jwt.verify(token, secret);
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private extractToken(request: any): string | null {
    const auth: string = request.headers?.authorization;
    return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  }
}
