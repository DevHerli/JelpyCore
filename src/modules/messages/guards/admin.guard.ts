import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Suscriptor } from '../../business/suscriptores/entities/suscriptores.entity';

@Injectable()
export class MessagesAdminGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,

    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const auth: string = request.headers?.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token de autenticación requerido');
    }

    let decoded: any;
    try {
      decoded = this.jwtService.verify(auth.slice(7));
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }

    // Verificar role directamente en BD (no del JWT) para evitar datos stale
    const suscriptor = await this.suscriptorRepo.findOne({
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
