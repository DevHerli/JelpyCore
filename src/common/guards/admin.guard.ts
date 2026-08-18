import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { Suscriptor } from '../../modules/business/suscriptores/entities/suscriptores.entity';

/**
 * Guard de rol admin: verifica el JWT y consulta la BD para confirmar
 * que el suscriptor tiene role = 'admin'. Se hace lookup en BD (no en
 * el claim del token) para evitar datos stale.
 *
 * Usa DataSource (registrado globalmente por TypeOrmModule.forRootAsync)
 * en lugar de @InjectRepository para evitar UnknownDependenciesException
 * en módulos que no importan TypeOrmModule.forFeature([Suscriptor]).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const auth: string = request.headers?.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) throw new UnauthorizedException('JWT_SECRET no configurado en el servidor');

    let decoded: any;
    try {
      decoded = jwt.verify(auth.slice(7), secret);
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    const suscriptor = await this.dataSource
      .getRepository(Suscriptor)
      .findOne({
        where: { id: decoded.sub, eliminado: false },
        select: { id: true, role: true } as any,
      });

    if (!suscriptor) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if ((suscriptor as any).role !== 'admin') {
      throw new ForbiddenException('No tienes permisos para esta acción');
    }

    request.user = { ...decoded, role: 'admin' };
    return true;
  }
}
