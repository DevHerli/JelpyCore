export class AIResponseBuilder {
  static buildFriendlyResponse(filtros: any, items: any[]) {
    const tipo = this.detectarTipo(filtros);

    if (!items || items.length === 0) {
      return this.respuestaSinResultados(tipo, filtros);
    }

    const respuestaBase = this.respuestaConResultados(tipo, filtros, items);

    return {
      ...respuestaBase,
      comentarioGlobal: this.mensajeGlobal(items, filtros),
    };
  }

  // Detectar el tipo según filtros/intención
  static detectarTipo(filtros: any): string {
    if (!filtros) return 'general';

    if (filtros.intent === 'buscar_items_negocio') return 'item_negocio';
    if (filtros.especialidadId) return 'especialidad';
    if (filtros.subcategoriaId) return 'subcategoria';
    if (filtros.categoriaId) return 'categoria';

    return 'general';
  }

  static respuestaConResultados(tipo: string, filtros: any, items: any[]) {
    const ciudad = filtros?.ciudad ?? items[0]?.ciudad ?? null;
    const ciudadTxt = ciudad ? ` en ${ciudad}` : '';

    const nombreCategoria =
      items[0]?.categoria ?? 'la categoría seleccionada';
    const nombreSubcategoria =
      items[0]?.subcategoria ?? 'la subcategoría seleccionada';
    const nombreEspecialidad =
      items[0]?.especialidad ?? 'la especialidad seleccionada';

    const nombreItem =
      items[0]?.item?.nombre ??
      items[0]?.item_encontrado ??
      filtros?.q ??
      'lo que buscas';

    const caracteristica =
      filtros?.caracteristica ??
      items[0]?.caracteristica ??
      null;

    let titulo = '';
    let resumen = '';

    switch (tipo) {
      case 'item_negocio':
        titulo = `Encontré ${nombreItem}${ciudadTxt}.`;
        resumen =
          'Estas sucursales tienen coincidencias con lo que estás buscando.';
        break;

      case 'especialidad':
        titulo = `Opciones de ${nombreEspecialidad}${ciudadTxt}.`;
        break;

      case 'subcategoria':
        titulo = `Opciones de ${nombreSubcategoria}${ciudadTxt}.`;
        break;

      case 'categoria':
        titulo = `Negocios de ${nombreCategoria}${ciudadTxt}.`;
        break;

      default:
        if (caracteristica && nombreSubcategoria && nombreSubcategoria !== 'la subcategoría seleccionada') {
          titulo = `Encontré ${nombreSubcategoria.toLowerCase()} con ${caracteristica}${ciudadTxt}.`;
        } else if (caracteristica && nombreCategoria && nombreCategoria !== 'la categoría seleccionada') {
          titulo = `Encontré lugares con ${caracteristica}${ciudadTxt}.`;
        } else if (caracteristica) {
          titulo = `Encontré lugares con ${caracteristica}${ciudadTxt}.`;
        } else {
          titulo = `Resultados disponibles${ciudadTxt}.`;
        }
        break;
    }

    return {
      titulo,
      resumen,
      items: this.listado(items),
    };
  }

  static respuestaSinResultados(tipo: string, filtros: any) {
    const ciudad = filtros?.ciudad ? ` en ${filtros.ciudad}` : '';
    const caracteristica = filtros?.caracteristica ?? null;

    if (tipo === 'item_negocio') {
      return {
        titulo: `No encontré ese producto o servicio${ciudad}.`,
        sugerencia:
          'Te recomiendo intentar con otra palabra, singular/plural, o algo más general.',
      };
    }

    if (caracteristica) {
      return {
        titulo: `No encontré lugares con ${caracteristica}${ciudad}.`,
        sugerencia:
          'Te recomiendo intentar con una palabra diferente, otra característica o algo más general.',
      };
    }

    return {
      titulo: `No encontré resultados${ciudad}.`,
      sugerencia:
        'Te recomiendo intentar con una palabra diferente o más general.',
    };
  }

  // ==================================
  // DISTANCIAS
  // ==================================
  static formatDistancia(km?: number): string | null {
    if (typeof km !== 'number') return null;

    if (km < 1) {
      const metros = Math.round(km * 1000);
      return `${metros} metros`;
    }

    if (km <= 20) {
      return `${km} km`;
    }

    return `${km} km (distancia considerable)`;
  }

  static mensajeDistancia(km?: number): string | null {
    if (typeof km !== 'number') return null;

    if (km < 1) return 'Muy cercano.';
    if (km <= 20) return 'A pocos minutos en coche.';
    return 'A una distancia considerable.';
  }

  // ==================================
  // MENSAJE GLOBAL
  // ==================================
  static mensajeGlobal(items: any[], filtros?: any): string {
    const tipo = this.detectarTipo(filtros);
    const caracteristica = filtros?.caracteristica ?? null;

    if (tipo === 'item_negocio') {
      const nombreItem =
        items[0]?.item?.nombre ??
        items[0]?.item_encontrado ??
        filtros?.q ??
        'ese producto o servicio';

      if (items.length === 1) {
        return `Encontré una sucursal que tiene ${nombreItem}.`;
      }

      return `Encontré varias sucursales que tienen ${nombreItem}.`;
    }

    if (caracteristica) {
      if (items.length === 1) {
        return `Encontré una sucursal que cuenta con ${caracteristica}.`;
      }

      return `Encontré varias sucursales que cuentan con ${caracteristica}.`;
    }

    if (items.length === 1) {
      return `Encontré una opción que coincide bien con lo que estás buscando.`;
    }

    const distancias = items
      .map((i) => i.distancia_km)
      .filter((d) => typeof d === 'number') as number[];

    if (distancias.length === 0) {
      return `Aquí tienes varias opciones disponibles.`;
    }

    const min = Math.min(...distancias);

    if (min < 1) {
      return `Hay opciones muy cercanas a tu ubicación.`;
    }

    if (min <= 20) {
      return `Ordené las opciones comenzando por las más cercanas.`;
    }

    return `Las opciones disponibles están algo retiradas, pero podrían ser útiles.`;
  }

  // ==================================
  // LISTADO
  // ==================================
  static listado(items: any[]) {
    return items.map((i, idx) => ({
      // Se conserva id como negocio_id para no romper compatibilidad
      id: i.negocio_id,

      // Nuevos campos explícitos para evitar confusión
      negocioId: i.negocio_id ?? null,
      sucursalId: i.sucursal_id ?? null,

      nombre: i.nombre_negocio,
      sucursal: i.sucursal,
      nombreSucursal: i.sucursal,

      ciudad: i.ciudad,
      categoria: i.categoria,
      subcategoria: i.subcategoria,
      especialidad: i.especialidad,

      // Nuevo: item encontrado
      item: i.item
        ? {
            nombre: i.item.nombre ?? null,
            descripcion: i.item.descripcion ?? null,
            precioBase: i.item.precioBase ?? null,
            tipo: i.item.tipo ?? null,
            imagenUrl: i.item.imagenUrl ?? null,
          }
        : i.item_encontrado
          ? {
              nombre: i.item_encontrado ?? null,
              descripcion: i.descripcion_item ?? null,
              precioBase: i.precio_item ?? null,
              tipo: i.tipo_item ?? null,
              imagenUrl: i.imagen_item ?? null,
            }
          : null,

      logo: i.logo_url ?? i.logo ?? null,

      abierto: i.abierto ?? 'Horario no disponible',
      estadoIcono: i.estadoIcono ?? 'unknown',

      horario: {
        apertura: i.horario?.apertura ?? null,
        cierre: i.horario?.cierre ?? null,
        mensaje: i.horario?.mensaje ?? 'Horario no disponible',
      },

      promo: i.promo ? `Promoción disponible: ${i.promo.titulo}` : null,

      distancia: this.formatDistancia(i.distancia_km),
      mensajeDistancia: this.mensajeDistancia(i.distancia_km),

      masCercano: idx === 0,
    }));
  }
}