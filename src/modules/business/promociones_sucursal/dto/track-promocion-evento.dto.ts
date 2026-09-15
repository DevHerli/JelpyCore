import { IsIn, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

// METRICS-002: DTO validado con class-validator + whitelist global (igual
// que TrackEventoDto en estadisticas/) — el endpoint es público/anónimo por
// diseño (app pública), así que no confía en nada que no esté en esta
// whitelist. `usuarioId` llega del cliente (mismo patrón ya usado por
// JelpyAssistantService.interpretar(), que manda usuarioId en el body sin
// pasar por un guard) — no es información sensible, sólo sirve para dedupe
// de "alcanzados" quien esté logueado.
export class TrackPromocionEventoDto {
  @IsIn(['vista', 'conversion'])
  tipoEvento!: 'vista' | 'conversion';

  @IsOptional()
  @IsIn(['llamada', 'whatsapp', 'como_llegar'])
  tipoConversion?: 'llamada' | 'whatsapp' | 'como_llegar';

  @IsOptional()
  @IsIn(['home', 'chat'])
  origen?: 'home' | 'chat';

  @IsOptional()
  @IsInt()
  @IsPositive()
  usuarioId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  deviceId?: string;
}
