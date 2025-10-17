import { Injectable } from '@nestjs/common';
import { Connection } from 'typeorm';
import { serverStartedAt } from '../../../main';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../../../../package.json');

interface DatabaseStatus {
  db: 'ok' | 'error';
  message?: string;
}

interface TablesStatus extends DatabaseStatus {
  tables?: { negocios: number; suscriptores: number };
}

@Injectable()
export class HealthService {
  constructor(private readonly connection: Connection) {}

  // 🔹 Verificación básica de la base de datos
  async checkDatabase(): Promise<DatabaseStatus> {
    try {
      await this.connection.query('SELECT 1');
      return { db: 'ok' };
    } catch (error: unknown) {
      return {
        db: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // 🔹 Verificación de tablas principales
  async checkTables(): Promise<TablesStatus> {
    try {
      const resultNegocios = (await this.connection.query(
        'SELECT COUNT(*) AS total FROM negocios',
      )) as { total: number }[];

      const resultSuscriptores = (await this.connection.query(
        'SELECT COUNT(*) AS total FROM suscriptores',
      )) as { total: number }[];

      const negocios = resultNegocios?.[0]?.total ?? 0;
      const suscriptores = resultSuscriptores?.[0]?.total ?? 0;

      return {
        db: 'ok',
        tables: { negocios, suscriptores },
      };
    } catch (error: unknown) {
      return {
        db: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // 🔹 Información general del servicio
  getStatusInfo(): { version: string; startedAt: string; uptime: string } {
    const uptimeSec = process.uptime();
    const uptimeMin = Math.floor(uptimeSec / 60);
    const uptimeStr = `${uptimeMin}m ${Math.floor(uptimeSec % 60)}s`;

    return {
      version: (pkg as { version?: string }).version || 'unknown',
      startedAt: serverStartedAt.toISOString(),
      uptime: uptimeStr,
    };
  }
}
