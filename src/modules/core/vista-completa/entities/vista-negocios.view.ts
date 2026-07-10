import { ViewEntity, ViewColumn } from 'typeorm';

@ViewEntity({ name: 'vista_negocios_completa', synchronize: false })
export class VistaNegociosCompleta {
  @ViewColumn()
  negocio_id: number;

  @ViewColumn()
  nombre_negocio: string;

  @ViewColumn()
  descripcion_negocio: string | null;

@ViewColumn()
ciudad_id: number | null;

  @ViewColumn()
  ciudad: string | null;

  @ViewColumn()
  categoria: string | null;

  @ViewColumn()
  categoria_id: number | null;

  @ViewColumn()
  subcategoria: string | null;

  @ViewColumn()
  subcategoria_id: number | null;

  @ViewColumn()
  especialidad: string | null;

  @ViewColumn()
  especialidad_id: number | null;

  @ViewColumn()
  sucursal_id: number | null;

  @ViewColumn()
  nombre_sucursal: string | null;

  @ViewColumn()
  latitud: number | null;

  @ViewColumn()
  longitud: number | null;

  @ViewColumn()
  horarios_keywords: string | null;

  @ViewColumn()
  promo_titulo: string | null;

  @ViewColumn()
  promo_descripcion: string | null;

  @ViewColumn()
  tipo_promocion: string | null;

  @ViewColumn()
  valor_descuento: number | null;

  @ViewColumn()
  promo_fecha_inicio: string | null;

  @ViewColumn()
  promo_fecha_fin: string | null;

  @ViewColumn()
  promo_hora_inicio: string | null;

  @ViewColumn()
  promo_hora_fin: string | null;

  @ViewColumn()
  promo_dias_vigencia: string | null;

  @ViewColumn()
  promo_activa: number | null;

  @ViewColumn()
  promo_imagen_url: string | null;

  @ViewColumn()
  promo_origen: string | null;

  @ViewColumn()
  catalogo_keywords: string | null;

  @ViewColumn()
  anuncio_keywords: string | null;

  @ViewColumn()
  caracteristicas_keywords: string | null;

  @ViewColumn()
items_keywords: string | null;
}