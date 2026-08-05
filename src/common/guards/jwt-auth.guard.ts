/**
 * JwtAuthGuard — JLP-M06
 *
 * Mejoras de seguridad sobre la versión anterior:
 *
 *  1. algorithms: ['HS256'] — rechaza explícitamente alg:none y RSA forgeries.
 *     Sin esto, una librería mal configurada podría aceptar tokens sin firma.
 *
 *  2. Revalidación de estado del usuario en BD en cada request:
 *     - Cuenta eliminada (eliminado=true) → 401 inmediato, sin esperar expiración.
 *     - Role se sobreescribe desde BD (no desde el claim del JWT):
 *       si un admin es degradado, el cambio es efectivo en el siguiente request,
 *       no tras la expiración del token (ventana de ataque ~15m → 0).
 *
 *  3. issuer / audience opcionales: si las env vars JWT_ISSUER / JWT_AUDIENCE
 *     están presentes, se validan; si no, se ignoran (retrocompatible).
 *
 * Coste: 1 query SELECT(id, role, eliminado) por request autenticado.
 * Con índice PK en suscriptores.id, el latency es <1ms en la mayoría de los casos.
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { Suscriptor } from '../../modules/business/suscriptores/entities/suscriptores.entity';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token   = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET no configurado en el servidor');
    }

    // Opciones de verificación — issuer/audience son opcionales pero recomendados
    const verifyOptions: jwt.VerifyOptions = {
      algorithms: ['HS256'], // bloquea alg:none y cualquier otro algoritmo no esperado
    };
    const issuer   = this.config.get<string>('JWT_ISSUER');
    const audience = this.config.get<string>('JWT_AUDIENCE');
    if (issuer)   verifyOptions.issuer   = issuer;
    if (audience) verifyOptions.audience = audience;

    let decoded: any;
    try {
      decoded = jwt.verify(token, secret, verifyOptions);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // Revalida en BD: cuenta existente, activa y no eliminada
    const suscriptor = await this.suscriptorRepo.findOne({
      where:  { id: decoded.sub, eliminado: false },
      select: { id: true, role: true } as any,
    });

    if (!suscriptor) {
      throw new UnauthorizedException('Cuenta no encontrada o desactivada');
    }

    // El role se toma de BD para que sea siempre fresco (degradación inmediata)
    request.user = { ...decoded, role: suscriptor.role };
    return true;
  }

  private extractToken(request: any): string | null {
    const auth: string = request.headers?.authorization;
    return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  }
}
