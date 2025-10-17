import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({ name: 'vista_negocios_completa' })
export class VistaNegociosCompleta {
  @ViewColumn() negocio_id: string;
  @ViewColumn() nombre_negocio: string;
  @ViewColumn() descripcion_negocio: string | null;
  @ViewColumn() membresia: string;
  @ViewColumn() estado_negocio: string;
  @ViewColumn() categoria: string | null;
  @ViewColumn() subcategoria: string | null;
  @ViewColumn() especialidad: string | null;

  @ViewColumn() sucursal_id: string | null;
  @ViewColumn() nombre_sucursal: string | null;
  @ViewColumn() direccion: string | null;
  @ViewColumn() ciudad: string | null;
  @ViewColumn() latitud: number | null;
  @ViewColumn() longitud: number | null;
  @ViewColumn() telefono: string | null;
  @ViewColumn() email: string | null;

  @ViewColumn() dia_semana: string | null;      // 'lunes'..'domingo'
  @ViewColumn() hora_apertura: string | null;   // TIME
  @ViewColumn() hora_cierre: string | null;     // TIME

  @ViewColumn() promo_titulo: string | null;
  @ViewColumn() promo_descripcion: string | null;
  @ViewColumn() promo_tipo: string | null;
  @ViewColumn() promo_fecha_inicio: string | null;
  @ViewColumn() promo_fecha_fin: string | null;
  @ViewColumn() promo_dias_validos: string | null;
}
