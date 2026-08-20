import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VentaMembresia } from './entities/ventas-membresia.entity';
import { Membresia } from '../../business/membresias/entities/membresia.entity';
import { CreateVentaMembresiaDto } from './dto/create-venta-membresia.dto';

/**
 * Construye el WHERE de los reportes con marcadores `?`, nunca concatenando
 * los valores.
 *
 * ── POR QUÉ EXISTE ESTA FUNCIÓN ───────────────────────────────────────────
 * Los cinco reportes de este servicio armaban el SQL así:
 *
 *   where += `AND v.fecha_compra BETWEEN '${fechaInicio}' AND '${fechaFin}' `;
 *   where += `AND v.ciudad_id = ${ciudadId} `;
 *
 * `fechaInicio` y `fechaFin` llegan como string crudo desde la query string
 * (@Query('fechaInicio') fechaInicio?: string) y se metían tal cual en la
 * consulta: inyección SQL de manual. Basta con
 *
 *   GET /ventas/membresias/resumen?fechaInicio=1' OR '1'='1
 *
 * para alterar la consulta. `ciudadId` y `anio` van declarados como number,
 * pero eso es sólo el tipo de TypeScript: en runtime un query param es string
 * y no hay DTO que lo valide, así que tampoco protegían.
 *
 * Los endpoints están detrás de ApiKeyGuard, lo que reduce la exposición pero
 * no la elimina: quien tenga la API key del panel de admin —o la filtre— podría
 * leer o destruir cualquier tabla de la base.
 */
function construirFiltros(f: {
  fechaInicio?: string;
  fechaFin?: string;
  ciudadId?: number;
  anio?: number;
}): { clausula: string; params: any[] } {
  const condiciones: string[] = [`v.estatus = 'pagado'`];
  const params: any[] = [];

  if (f.anio != null && Number.isFinite(Number(f.anio))) {
    condiciones.push('YEAR(v.fecha_compra) = ?');
    params.push(Number(f.anio));
  }

  if (f.fechaInicio && f.fechaFin) {
    condiciones.push('v.fecha_compra BETWEEN ? AND ?');
    params.push(f.fechaInicio, f.fechaFin);
  }

  if (f.ciudadId != null && Number.isFinite(Number(f.ciudadId))) {
    condiciones.push('v.ciudad_id = ?');
    params.push(Number(f.ciudadId));
  }

  return { clausula: `WHERE ${condiciones.join(' AND ')} `, params };
}

@Injectable()
export class VentasMembresiasService {
  constructor(
    @InjectRepository(VentaMembresia)
    private readonly ventasRepo: Repository<VentaMembresia>,
    @InjectRepository(Membresia)
    private readonly membresiaRepo: Repository<Membresia>,
  ) {}

  async registrar(dto: CreateVentaMembresiaDto) {
    // Calcular fechaExpiracion automáticamente si no viene en el DTO
    let fechaExpiracion: Date | null = dto.fechaExpiracion ? new Date(dto.fechaExpiracion) : null;

    if (!fechaExpiracion) {
      const membresia = await this.membresiaRepo.findOne({ where: { id: dto.membresiaId } });
      if (!membresia) throw new NotFoundException(`Membresía no existe: id=${dto.membresiaId}`);

      const inicio = new Date();
      inicio.setMonth(inicio.getMonth() + (membresia.duracion_meses || 1));
      fechaExpiracion = inicio;
    }

    const nueva = this.ventasRepo.create({
      suscriptor: { id: dto.suscriptorId } as any,
      negocio: dto.negocioId ? ({ id: dto.negocioId } as any) : null,
      membresia: { id: dto.membresiaId } as any,
      ciudad: dto.ciudadId ? ({ id: dto.ciudadId } as any) : null,
      monto: dto.monto,
      metodoPago: dto.metodoPago ?? 'tarjeta',
      estatus: dto.estatus ?? 'pagado',
      fechaExpiracion,
    });
    return this.ventasRepo.save(nueva);
  }

  async resumen(fechaInicio?: string, fechaFin?: string, ciudadId?: number) {
    // JLP-SQLI — los filtros se pasan como parámetros, nunca interpolados.
    const { clausula, params } = construirFiltros({ fechaInicio, fechaFin, ciudadId });

    const query = `
      SELECT
        m.nombre AS membresia,
        COUNT(v.id) AS total_vendidas,
        SUM(v.monto) AS total_recaudado
      FROM ventas_membresias v
      INNER JOIN membresias m ON m.id = v.membresia_id
      ${clausula}
      GROUP BY m.nombre
      ORDER BY total_recaudado DESC;
    `;

    return this.ventasRepo.query(query, params);
  }

  async porSuscriptor(suscriptorId: number) {
    return this.ventasRepo.find({
      where: { suscriptor: { id: suscriptorId } },
      order: { fechaCompra: 'DESC' },
    });
  }

  async porNegocio(negocioId: number) {
    return this.ventasRepo.find({
      where: { negocio: { id: negocioId } },
      order: { fechaCompra: 'DESC' },
    });
  }



// REPORTE POR CIUDAD Y MEMBRESÍA
async reportePorCiudad(fechaInicio?: string, fechaFin?: string) {
  const { clausula, params } = construirFiltros({ fechaInicio, fechaFin });

  const query = `
    SELECT
      c.nombre AS ciudad,
      m.nombre AS membresia,
      COUNT(v.id) AS total_vendidas,
      SUM(v.monto) AS total_recaudado
    FROM ventas_membresias v
    LEFT JOIN ciudades c ON c.id = v.ciudad_id
    INNER JOIN membresias m ON m.id = v.membresia_id
    ${clausula}
    GROUP BY c.nombre, m.nombre
    ORDER BY c.nombre ASC, total_recaudado DESC;
  `;

  return this.ventasRepo.query(query, params);
}

// REPORTE DE VENTAS MENSUAL (POR AÑO Y CIUDAD OPCIONAL)
async reporteMensual(anio?: number, ciudadId?: number) {
  const year = anio ?? new Date().getFullYear();
  const { clausula, params } = construirFiltros({ anio: year, ciudadId });

  const query = `
    SELECT
      MONTH(v.fecha_compra) AS mes,
      COUNT(v.id) AS total_vendidas,
      SUM(v.monto) AS total_recaudado
    FROM ventas_membresias v
    ${clausula}
    GROUP BY MONTH(v.fecha_compra)
    ORDER BY mes ASC;
  `;

  const resultados = await this.ventasRepo.query(query, params);

  // 🔹 Calcula crecimiento mes a mes
  const reporte = resultados.map((r, i) => {
    const actual = Number(r.total_recaudado);
    const anterior = i > 0 ? Number(resultados[i - 1].total_recaudado) : 0;
    const crecimiento = anterior ? ((actual - anterior) / anterior) * 100 : 0;

    return {
      mes: this.obtenerNombreMes(r.mes),
      total_vendidas: Number(r.total_vendidas),
      total_recaudado: actual,
      crecimiento: parseFloat(crecimiento.toFixed(2)),
    };
  });

  return reporte;
}

// Helper para convertir número de mes a nombre
private obtenerNombreMes(numero: number): string {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return meses[numero - 1] || 'Desconocido';
}



// 🔹 REPORTE DE VENTAS ANUAL (COMPARATIVO)
async reporteAnual(ciudadId?: number) {
  const { clausula, params } = construirFiltros({ ciudadId });

  const query = `
    SELECT
      YEAR(v.fecha_compra) AS anio,
      COUNT(v.id) AS total_vendidas,
      SUM(v.monto) AS total_recaudado
    FROM ventas_membresias v
    ${clausula}
    GROUP BY YEAR(v.fecha_compra)
    ORDER BY anio ASC;
  `;

  const resultados = await this.ventasRepo.query(query, params);

  // 🔹 Calcular crecimiento año a año
  const reporte = resultados.map((r, i) => {
    const actual = Number(r.total_recaudado);
    const anterior = i > 0 ? Number(resultados[i - 1].total_recaudado) : 0;
    const crecimiento = anterior ? ((actual - anterior) / anterior) * 100 : 0;

    return {
      anio: Number(r.anio),
      total_vendidas: Number(r.total_vendidas),
      total_recaudado: actual,
      crecimiento: parseFloat(crecimiento.toFixed(2)),
    };
  });

  return reporte;
}



}
