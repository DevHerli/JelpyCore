import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VentaMembresia } from './entities/ventas-membresia.entity';
import { CreateVentaMembresiaDto } from './dto/create-venta-membresia.dto';

@Injectable()
export class VentasMembresiasService {
  constructor(
    @InjectRepository(VentaMembresia)
    private readonly ventasRepo: Repository<VentaMembresia>,
  ) {}

  async registrar(dto: CreateVentaMembresiaDto) {
    const nueva = this.ventasRepo.create({
      suscriptor: { id: dto.suscriptorId } as any,
      negocio: dto.negocioId ? ({ id: dto.negocioId } as any) : null,
      membresia: { id: dto.membresiaId } as any,
      ciudad: dto.ciudadId ? ({ id: dto.ciudadId } as any) : null,
      monto: dto.monto,
      metodoPago: dto.metodoPago ?? 'tarjeta',
      estatus: dto.estatus ?? 'pagado',
      fechaExpiracion: dto.fechaExpiracion ? new Date(dto.fechaExpiracion) : null,
    });
    return this.ventasRepo.save(nueva);
  }

  async resumen(fechaInicio?: string, fechaFin?: string, ciudadId?: number) {
    let where = `WHERE v.estatus = 'pagado' `;
    if (fechaInicio && fechaFin)
      where += `AND v.fecha_compra BETWEEN '${fechaInicio}' AND '${fechaFin}' `;
    if (ciudadId)
      where += `AND v.ciudad_id = ${ciudadId} `;

    const query = `
      SELECT 
        m.nombre AS membresia,
        COUNT(v.id) AS total_vendidas,
        SUM(v.monto) AS total_recaudado
      FROM ventas_membresias v
      INNER JOIN membresias m ON m.id = v.membresia_id
      ${where}
      GROUP BY m.nombre
      ORDER BY total_recaudado DESC;
    `;

    return this.ventasRepo.query(query);
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
  let where = `WHERE v.estatus = 'pagado' `;
  if (fechaInicio && fechaFin)
    where += `AND v.fecha_compra BETWEEN '${fechaInicio}' AND '${fechaFin}' `;

  const query = `
    SELECT 
      c.nombre AS ciudad,
      m.nombre AS membresia,
      COUNT(v.id) AS total_vendidas,
      SUM(v.monto) AS total_recaudado
    FROM ventas_membresias v
    LEFT JOIN ciudades c ON c.id = v.ciudad_id
    INNER JOIN membresias m ON m.id = v.membresia_id
    ${where}
    GROUP BY c.nombre, m.nombre
    ORDER BY c.nombre ASC, total_recaudado DESC;
  `;

  return this.ventasRepo.query(query);
}

// REPORTE DE VENTAS MENSUAL (POR AÑO Y CIUDAD OPCIONAL)
async reporteMensual(anio?: number, ciudadId?: number) {
  const year = anio ?? new Date().getFullYear();
  let where = `WHERE YEAR(v.fecha_compra) = ${year} AND v.estatus = 'pagado' `;
  if (ciudadId) where += `AND v.ciudad_id = ${ciudadId} `;

  const query = `
    SELECT 
      MONTH(v.fecha_compra) AS mes,
      COUNT(v.id) AS total_vendidas,
      SUM(v.monto) AS total_recaudado
    FROM ventas_membresias v
    ${where}
    GROUP BY MONTH(v.fecha_compra)
    ORDER BY mes ASC;
  `;

  const resultados = await this.ventasRepo.query(query);

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
  let where = `WHERE v.estatus = 'pagado' `;
  if (ciudadId) where += `AND v.ciudad_id = ${ciudadId} `;

  const query = `
    SELECT 
      YEAR(v.fecha_compra) AS anio,
      COUNT(v.id) AS total_vendidas,
      SUM(v.monto) AS total_recaudado
    FROM ventas_membresias v
    ${where}
    GROUP BY YEAR(v.fecha_compra)
    ORDER BY anio ASC;
  `;

  const resultados = await this.ventasRepo.query(query);

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
