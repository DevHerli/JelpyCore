import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromocionSucursal } from './entities/promocion-sucursal.entity';
import { SucursalNegocio } from '../sucursales_negocios/entities/sucursal-negocio.entity';
import { CreatePromocionSucursalDto } from './dto/create-promocion-sucursal.dto';
import { UpdatePromocionSucursalDto } from './dto/update-promocion-sucursal.dto';

@Injectable()
export class PromocionesSucursalesService {
  constructor(
    @InjectRepository(PromocionSucursal)
    private readonly promoRepo: Repository<PromocionSucursal>,

    @InjectRepository(SucursalNegocio)
    private readonly sucursalRepo: Repository<SucursalNegocio>,
  ) {}

  /**
   * Crear una nueva promoción
   */
  async crear(dto: CreatePromocionSucursalDto): Promise<PromocionSucursal> {
    const sucursal = await this.sucursalRepo.findOne({ where: { id: dto.sucursalId } });
    if (!sucursal) throw new NotFoundException('Sucursal no encontrada');

    const nueva = this.promoRepo.create({
      ...dto,
      sucursal,
      diasVigencia: dto.diasVigencia && Array.isArray(dto.diasVigencia)
        ? dto.diasVigencia.join(',')
        : null,
    });

    return this.promoRepo.save(nueva);
  }

  /**
   * Listar todas las promociones no eliminadas
   */
  async listar(): Promise<PromocionSucursal[]> {
    return this.promoRepo.find({
      where: { eliminado: false },
      relations: ['sucursal'],
      order: { fechaInicio: 'DESC' },
    });
  }

  /**
   * Listar promociones por sucursal
   */
  async listarPorSucursal(sucursalId: number): Promise<PromocionSucursal[]> {
    return this.promoRepo.find({
      where: { sucursal: { id: sucursalId }, eliminado: false },
      relations: ['sucursal'],
      order: { fechaInicio: 'DESC' },
    });
  }

  /**
   * Obtener promociones activas actualmente
   * Filtra por día, fecha y estado
   */
  async listarPromocionesActivas(ciudadId?: number): Promise<PromocionSucursal[]> {
    const hoy = new Date();
    const diaActual = hoy
      .toLocaleString('es-MX', { weekday: 'long' })
      .replace(/^\w/, (c) => c.toUpperCase());

    const query = this.promoRepo
      .createQueryBuilder('promo')
      .leftJoinAndSelect('promo.sucursal', 'sucursal')
      .leftJoinAndSelect('sucursal.ciudad', 'ciudad')
      .where('promo.eliminado = 0')
      .andWhere('promo.activa = 1')
      .andWhere('CURDATE() BETWEEN promo.fecha_inicio AND promo.fecha_fin')
      .andWhere('FIND_IN_SET(:dia, promo.dias_vigencia) > 0', { dia: diaActual });

    if (ciudadId) {
      query.andWhere('ciudad.id = :ciudadId', { ciudadId });
    }

    const resultados = await query.orderBy('promo.fecha_inicio', 'DESC').getMany();
    return resultados;
  }

  /**
   * Obtener promociones activas filtradas por ciudad, categoría o subcategoría
   */
  async listarPromocionesActivasFiltradas(
    ciudadId?: number,
    categoriaId?: number,
    subcategoriaId?: number,
  ): Promise<PromocionSucursal[]> {
    const hoy = new Date();
    const diaActual = hoy
      .toLocaleString('es-MX', { weekday: 'long' })
      .replace(/^\w/, (c) => c.toUpperCase());

    const query = this.promoRepo
      .createQueryBuilder('promo')
      .leftJoinAndSelect('promo.sucursal', 'sucursal')
      .leftJoinAndSelect('sucursal.negocio', 'negocio')
      .leftJoinAndSelect('negocio.categoria', 'categoria')
      .leftJoinAndSelect('negocio.subcategoria', 'subcategoria')
      .leftJoinAndSelect('sucursal.ciudad', 'ciudad')
      .where('promo.eliminado = 0')
      .andWhere('promo.activa = 1')
      .andWhere('CURDATE() BETWEEN promo.fecha_inicio AND promo.fecha_fin')
      .andWhere('FIND_IN_SET(:dia, promo.dias_vigencia) > 0', { dia: diaActual });

    if (ciudadId) query.andWhere('ciudad.id = :ciudadId', { ciudadId });
    if (categoriaId) query.andWhere('categoria.id = :categoriaId', { categoriaId });
    if (subcategoriaId) query.andWhere('subcategoria.id = :subcategoriaId', { subcategoriaId });

    const resultados = await query.orderBy('promo.fecha_inicio', 'DESC').getMany();
    return resultados;
  }


/**
 * Listar promociones próximas (aún no iniciadas)
 * Ejemplo: aquellas donde fecha_inicio > CURDATE()
 */
async listarPromocionesProximas(
  ciudadId?: number,
  categoriaId?: number,
  subcategoriaId?: number,
): Promise<PromocionSucursal[]> {
  const query = this.promoRepo
    .createQueryBuilder('promo')
    .leftJoinAndSelect('promo.sucursal', 'sucursal')
    .leftJoinAndSelect('sucursal.negocio', 'negocio')
    .leftJoinAndSelect('negocio.categoria', 'categoria')
    .leftJoinAndSelect('negocio.subcategoria', 'subcategoria')
    .leftJoinAndSelect('sucursal.ciudad', 'ciudad')
    .where('promo.eliminado = 0')
    .andWhere('promo.activa = 1')
    .andWhere('promo.fecha_inicio > CURDATE()');

  if (ciudadId) query.andWhere('ciudad.id = :ciudadId', { ciudadId });
  if (categoriaId) query.andWhere('categoria.id = :categoriaId', { categoriaId });
  if (subcategoriaId) query.andWhere('subcategoria.id = :subcategoriaId', { subcategoriaId });

  return query.orderBy('promo.fecha_inicio', 'ASC').getMany();
}


/**
 * Listar promociones finalizadas (ya vencidas)
 * Muestra promociones cuya fecha_fin es anterior a la fecha actual.
 */
async listarPromocionesFinalizadas(
  ciudadId?: number,
  categoriaId?: number,
  subcategoriaId?: number,
): Promise<PromocionSucursal[]> {
  const query = this.promoRepo
    .createQueryBuilder('promo')
    .leftJoinAndSelect('promo.sucursal', 'sucursal')
    .leftJoinAndSelect('sucursal.negocio', 'negocio')
    .leftJoinAndSelect('negocio.categoria', 'categoria')
    .leftJoinAndSelect('negocio.subcategoria', 'subcategoria')
    .leftJoinAndSelect('sucursal.ciudad', 'ciudad')
    .where('promo.eliminado = 0')
    .andWhere('promo.fecha_fin < CURDATE()');

  if (ciudadId) query.andWhere('ciudad.id = :ciudadId', { ciudadId });
  if (categoriaId) query.andWhere('categoria.id = :categoriaId', { categoriaId });
  if (subcategoriaId) query.andWhere('subcategoria.id = :subcategoriaId', { subcategoriaId });

  return query.orderBy('promo.fecha_fin', 'DESC').getMany();
}



/**
 * Obtener resumen general de promociones
 * Incluye: activas, próximas, finalizadas y próximas a vencer
 */
async obtenerResumenPromociones(): Promise<any> {
  const hoy = new Date();

  // Fecha límite para las que están por vencer (3 días desde hoy)
  const fechaLimite = new Date();
  fechaLimite.setDate(hoy.getDate() + 3);

  // 🔸 Total de promociones activas
  const totalActivas = await this.promoRepo
    .createQueryBuilder('promo')
    .where('promo.activa = 1')
    .andWhere('promo.eliminado = 0')
    .andWhere('CURDATE() BETWEEN promo.fecha_inicio AND promo.fecha_fin')
    .getCount();

  // 🔸 Total de promociones próximas
  const totalProximas = await this.promoRepo
    .createQueryBuilder('promo')
    .where('promo.activa = 1')
    .andWhere('promo.eliminado = 0')
    .andWhere('promo.fecha_inicio > CURDATE()')
    .getCount();

  // 🔸 Total de promociones finalizadas
  const totalFinalizadas = await this.promoRepo
    .createQueryBuilder('promo')
    .where('promo.eliminado = 0')
    .andWhere('promo.fecha_fin < CURDATE()')
    .getCount();

  // 🔸 Promociones por vencer (dentro de los próximos 3 días)
  const proximasAVencer = await this.promoRepo
    .createQueryBuilder('promo')
    .leftJoinAndSelect('promo.sucursal', 'sucursal')
    .leftJoinAndSelect('sucursal.negocio', 'negocio')
    .where('promo.eliminado = 0')
    .andWhere('promo.activa = 1')
    .andWhere('promo.fecha_fin BETWEEN CURDATE() AND :fechaLimite', { fechaLimite })
    .orderBy('promo.fecha_fin', 'ASC')
    .getMany();

  // 🔸 Categorías con más promociones activas
  const categoriasTop = await this.promoRepo
    .createQueryBuilder('promo')
    .leftJoin('promo.sucursal', 'sucursal')
    .leftJoin('sucursal.negocio', 'negocio')
    .leftJoin('negocio.categoria', 'categoria')
    .select('categoria.nombre', 'categoria')
    .addSelect('COUNT(promo.id)', 'total')
    .where('promo.activa = 1')
    .andWhere('promo.eliminado = 0')
    .andWhere('CURDATE() BETWEEN promo.fecha_inicio AND promo.fecha_fin')
    .groupBy('categoria.nombre')
    .orderBy('total', 'DESC')
    .limit(5)
    .getRawMany();

  return {
    fechaGeneracion: hoy,
    resumen: {
      activas: totalActivas,
      proximas: totalProximas,
      finalizadas: totalFinalizadas,
    },
    proximasAVencer,
    categoriasDestacadas: categoriasTop,
  };
}


/**
 * 🔹 Obtener estadísticas avanzadas de promociones
 */
async obtenerEstadisticasPromociones(): Promise<any> {
  // Total de vistas y clics
  const totales = await this.promoRepo.query(`
    SELECT 
      SUM(vistas) AS totalVistas,
      SUM(clics) AS totalClics,
      ROUND(SUM(clics) / NULLIF(SUM(vistas), 0) * 100, 2) AS eficiencia
    FROM estadisticas_promociones
  `);

  // Top 5 promociones más vistas
  const masVistas = await this.promoRepo.query(`
    SELECT 
      p.id,
      p.titulo,
      s.nombre_sucursal AS sucursal,
      n.nombre_negocio AS negocio,
      e.vistas
    FROM estadisticas_promociones e
    INNER JOIN promociones_sucursales p ON e.promocion_id = p.id
    INNER JOIN sucursales_negocios s ON p.sucursal_id = s.id
    INNER JOIN negocios n ON s.negocio_id = n.id
    ORDER BY e.vistas DESC
    LIMIT 5
  `);

  // Top 5 promociones con más clics
  const masClics = await this.promoRepo.query(`
    SELECT 
      p.id,
      p.titulo,
      s.nombre_sucursal AS sucursal,
      n.nombre_negocio AS negocio,
      e.clics
    FROM estadisticas_promociones e
    INNER JOIN promociones_sucursales p ON e.promocion_id = p.id
    INNER JOIN sucursales_negocios s ON p.sucursal_id = s.id
    INNER JOIN negocios n ON s.negocio_id = n.id
    ORDER BY e.clics DESC
    LIMIT 5
  `);

  // Top 5 sucursales con más promociones activas
  const sucursalesActivas = await this.promoRepo.query(`
    SELECT 
      s.id,
      s.nombre_sucursal,
      COUNT(p.id) AS totalPromociones
    FROM sucursales_negocios s
    INNER JOIN promociones_sucursales p ON s.id = p.sucursal_id
    WHERE p.eliminado = 0 AND p.activa = 1
    GROUP BY s.id
    ORDER BY totalPromociones DESC
    LIMIT 5
  `);

  return {
    fechaGeneracion: new Date(),
    totales: totales[0],
    top: {
      masVistas,
      masClics,
      sucursalesActivas,
    },
  };
}


/**
 * 🔹 Registrar una vista de promoción
 */
async registrarVista(promocionId: number): Promise<any> {
  const existe = await this.promoRepo.query(
    `SELECT * FROM estadisticas_promociones WHERE promocion_id = ? LIMIT 1`,
    [promocionId],
  );

  if (existe.length > 0) {
    // Ya existe → solo actualizamos vistas
    await this.promoRepo.query(
      `UPDATE estadisticas_promociones SET vistas = vistas + 1 WHERE promocion_id = ?`,
      [promocionId],
    );
  } else {
    // No existe → crear registro
    await this.promoRepo.query(
      `INSERT INTO estadisticas_promociones (promocion_id, vistas, clics) VALUES (?, 1, 0)`,
      [promocionId],
    );
  }

  return { message: 'Vista registrada correctamente', promocionId };
}

/**
 * 🔹 Registrar un clic de promoción
 */
async registrarClic(promocionId: number): Promise<any> {
  const existe = await this.promoRepo.query(
    `SELECT * FROM estadisticas_promociones WHERE promocion_id = ? LIMIT 1`,
    [promocionId],
  );

  if (existe.length > 0) {
    await this.promoRepo.query(
      `UPDATE estadisticas_promociones SET clics = clics + 1 WHERE promocion_id = ?`,
      [promocionId],
    );
  } else {
    await this.promoRepo.query(
      `INSERT INTO estadisticas_promociones (promocion_id, vistas, clics) VALUES (?, 0, 1)`,
      [promocionId],
    );
  }

  return { message: 'Clic registrado correctamente', promocionId };
}



  /**
   * Actualizar una promoción
   */
async actualizar(id: number, dto: UpdatePromocionSucursalDto): Promise<PromocionSucursal> {
  const promo = await this.promoRepo.findOne({ where: { id } });
  if (!promo) throw new NotFoundException('Promoción no encontrada');

  // Convertir arreglo de días a string, si viene en el DTO
  const diasVigencia =
    dto.diasVigencia && Array.isArray(dto.diasVigencia)
      ? dto.diasVigencia.join(',')
      : undefined;

  // Asignar todo al objeto promo, incluyendo conversión de días
  Object.assign(promo, {
    ...dto,
    diasVigencia, // ya como string
  });

  return this.promoRepo.save(promo);
}


  /**
   * Eliminar (lógicamente) una promoción
   */
  async eliminar(id: number): Promise<PromocionSucursal> {
    const promo = await this.promoRepo.findOne({ where: { id } });
    if (!promo) throw new NotFoundException('Promoción no encontrada');

    promo.eliminado = true;
    promo.activa = false;

    return this.promoRepo.save(promo);
  }
}
