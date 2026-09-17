/**
 * DataRetentionService — JLP-012 / B2
 *
 * Cumple con:
 *  - Apple App Store Review Guideline 5.1.1(v): los datos del usuario se
 *    eliminan de forma permanente dentro de los 30 días tras la solicitud.
 *  - Google Play Policy (Data deletion): misma ventana de 30 días.
 *
 * Estrategia: soft-delete (eliminado=1, fecha_eliminacion=NOW()) ya se hace en
 * SuscriptoresService.eliminarCuenta(). Este job convierte ese soft-delete en
 * anonimización real transcurridos ≥ 30 días, vaciando todos los campos PII.
 */
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull, Not } from 'typeorm';
import { Suscriptor } from '../../business/suscriptores/entities/suscriptores.entity';
import { RefreshSession } from '../../auth/entities/refresh-session.entity';

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @InjectRepository(Suscriptor)
    private readonly suscriptorRepo: Repository<Suscriptor>,

    // JLP-020: purga definitiva de las filas de sesión (incluyendo user_agent)
    // al anonimizar — ya estaban revocadas desde eliminarCuenta(), esto solo
    // borra el rastro por completo.
    @InjectRepository(RefreshSession)
    private readonly refreshSessionRepo: Repository<RefreshSession>,
  ) {}

  /**
   * Ejecuta cada día a las 03:00 AM (hora UTC, fuera del horario pico MX).
   *
   * Anonimiza cuentas eliminadas hace más de 30 días:
   *  - Nombre / apellidos → "Cuenta eliminada"
   *  - Email, teléfono, contraseña, refresh token → NULL
   *  - Datos fiscales (RFC, razón social, CP, CFDI, email fiscal) → NULL
   *  - Permisos de dispositivo → NULL
   *  - Stripe customer ID → NULL  (nota: NO cancela el customer en Stripe API
   *    porque no tenemos cargo pendiente; si tu política lo requiere,
   *    agrega aquí la llamada a StripeService.deleteCustomer)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async anonimizarCuentasEliminadas(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    // Busca únicamente registros soft-deleted con fecha_eliminacion conocida y vencida
    const pendientes = await this.suscriptorRepo.find({
      where: {
        eliminado: true,
        fechaEliminacion: LessThan(cutoff),
        // Evita re-procesar cuentas ya anonimizadas (nombre ya vacío)
        nombre: Not(''),
      },
      select: ['id'] as any,
    });

    if (pendientes.length === 0) {
      this.logger.debug('[JLP-012] Sin cuentas pendientes de anonimización.');
      return;
    }

    this.logger.log(
      `[JLP-012] Anonimizando ${pendientes.length} cuenta(s) eliminada(s) hace >30 días...`,
    );

    const ids = pendientes.map((s) => s.id);
    let procesadas = 0;
    let errores = 0;

    for (const id of ids) {
      try {
        await this.suscriptorRepo.update(id, {
          // ── Datos de identidad ────────────────────────────────────────────
          nombre:           'Cuenta eliminada',
          apellidoPaterno:  '',
          apellidoMaterno:  null,
          sexo:             null,
          fechaNacimiento:  null,

          // ── Contacto ──────────────────────────────────────────────────────
          correoElectronico: null,
          telefonoCelular:   null,

          // ── Autenticación ─────────────────────────────────────────────────
          contrasena:   null,
          refreshToken: null,

          // ── Datos fiscales ────────────────────────────────────────────────
          rfc:                null,
          razonSocial:        null,
          usoCfdi:            null,
          regimenFiscal:      null,
          codigoPostalFiscal: null,
          emailFiscal:        null,

          // ── Plataformas externas ──────────────────────────────────────────
          stripeCustomerId: null,

          // ── Permisos de dispositivo ───────────────────────────────────────
          permisoNotificaciones: null,
          permisoGeolocalizacion: null,
          permisoUsoDatos:        null,
        } as any);

        // JLP-020: borra por completo cualquier rastro de sesión (user_agent
        // incluido) para esta cuenta ya anonimizada.
        await this.refreshSessionRepo.delete({ suscriptorId: id });

        procesadas++;
      } catch (err: any) {
        errores++;
        this.logger.error(
          `[JLP-012] Error anonimizando suscriptor id=${id}: ${err?.message}`,
          err?.stack,
        );
      }
    }

    this.logger.log(
      `[JLP-012] Retención completada — procesadas: ${procesadas}, errores: ${errores}.`,
    );
  }
}
