import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { HealthService } from './health.service';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly configService: ConfigService,
  ) {}

  //Health básico
  @Get()
  async check() {
    const dbStatus = await this.healthService.checkDatabase();
    const info = this.healthService.getStatusInfo();

    const ok = dbStatus.db === 'ok';

    return {
      ok,
      status: ok ? 'Servicio operativo' : 'Error de conexión a la base de datos',
      db: dbStatus.db,
      message: dbStatus.message || undefined,
      environment: this.configService.get('NODE_ENV') || 'development',
      version: info.version,
      startedAt: info.startedAt,
      uptime: info.uptime,
      at: new Date().toISOString(),
    };
  }

  /**
   * JLP-H17 — Health extendido: expone nombres de tablas de la BD, versión y
   * uptime. Restringido a administradores para evitar reconocimiento del esquema
   * por parte de atacantes.
   * El endpoint básico GET /health permanece público (requerido por Render/uptime).
   */
  @Get('deep')
  @UseGuards(AdminGuard)
  async deepCheck() {
    const dbStatus = await this.healthService.checkTables();
    const info = this.healthService.getStatusInfo();

    const ok = dbStatus.db === 'ok';

    return {
      ok,
      status: ok
        ? 'Servicio y base de datos operativos'
        : 'Error al consultar las tablas principales',
      db: dbStatus.db,
      tables: dbStatus.tables || null,
      message: dbStatus.message || undefined,
      version: info.version,
      uptime: info.uptime,
      at: new Date().toISOString(),
    };
  }
}
