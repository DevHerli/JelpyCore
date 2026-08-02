import { IsBoolean, IsOptional } from 'class-validator';

/**
 * PATCH /suscriptores/:id/permisos
 *
 * Almacena los permisos del dispositivo que el usuario otorga/deniega
 * en los diálogos nativos de la app (notificaciones push, geolocalización,
 * uso de datos / analytics).
 *
 * Semántica del campo (igual para los tres):
 *   true  → el usuario concedió el permiso
 *   false → el usuario lo denegó
 *   null  → no se ha preguntado aún (no enviar el campo para dejarlo sin cambiar)
 */
export class UpdatePermisosDto {
  /** Permiso de notificaciones push (iOS / Android) */
  @IsOptional()
  @IsBoolean()
  notificaciones?: boolean;

  /** Permiso de geolocalización */
  @IsOptional()
  @IsBoolean()
  geolocalizacion?: boolean;

  /** Consentimiento de uso de datos / analytics */
  @IsOptional()
  @IsBoolean()
  usoDatos?: boolean;
}
