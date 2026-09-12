import { IsIn, IsInt, IsPositive } from 'class-validator';
import { TIPOS_EVENTO_ESTADISTICA, TipoEventoEstadistica } from '../estadisticas.service';

// JLP-SEC / METRICS-001: POST /estadisticas/evento no tenía DTO — aceptaba
// cualquier string en `tipo`/`entidad` en runtime (el tipado de TS solo
// protege en compile-time, no contra un curl directo). Con ValidationPipe
// global ({ whitelist: true, transform: true } en main.ts), este DTO
// rechaza valores fuera de whitelist con 400 en vez de dejarlos pasar a
// registrarEvento (que además ya valida por su cuenta como defensa extra).
export class TrackEventoDto {
  @IsIn(['negocio', 'sucursal'])
  entidad!: 'negocio' | 'sucursal';

  @IsInt()
  @IsPositive()
  id!: number;

  @IsIn(TIPOS_EVENTO_ESTADISTICA)
  tipo!: TipoEventoEstadistica;
}
