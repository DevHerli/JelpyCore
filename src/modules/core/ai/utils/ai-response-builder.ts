export class AIResponseBuilder {
  static buildFriendlyResponse(filtros: any, items: any[]) {
    const tipo = this.detectarTipo(filtros);

    if (!items || items.length === 0) {
      return this.respuestaSinResultados(tipo, filtros);
    }

    const respuestaBase = this.respuestaConResultados(tipo, filtros, items);

    return {
      ...respuestaBase,
      comentarioGlobal: this.mensajeGlobal(items),
    };
  }

  // Detectar el tipo según IDs presentes
  static detectarTipo(filtros: any): string {
    if (!filtros) return 'general';

    if (filtros.especialidadId) return 'especialidad';
    if (filtros.subcategoriaId) return 'subcategoria';
    if (filtros.categoriaId) return 'categoria';

    return 'general';
  }

  static respuestaConResultados(tipo: string, filtros: any, items: any[]) {
      const ciudad = filtros?.ciudad ?? items[0]?.ciudad ?? null;
      const ciudadTxt = ciudad ? ` en ${ciudad}` : '';
    
      const nombreCategoria = items[0]?.categoria ?? 'la categoría seleccionada';
      const nombreSubcategoria = items[0]?.subcategoria ?? 'la subcategoría seleccionada';
      const nombreEspecialidad = items[0]?.especialidad ?? 'la especialidad seleccionada';
    
      let titulo = '';
      let resumen = '';
    
      switch (tipo) {
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
          titulo = `Resultados disponibles${ciudadTxt}.`;
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

    return {
      titulo: `No encontramos resultados${ciudad}.`,
      sugerencia: `Te recomendamos intentar con una palabra diferente o más general.`,
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
  static mensajeGlobal(items: any[]): string {
    if (items.length === 1) {
      return `Encontramos una opción que coincide bien con lo que estás buscando.`;
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
      return `Ordenamos las opciones comenzando por las más cercanas.`;
    }

    return `Las opciones disponibles están algo retiradas, pero podrían ser útiles.`;
  }

  // ==================================
  // LISTADO — AQUÍ SOLO AGREGO HORARIOS 🔥
  // ==================================
  static listado(items: any[]) {
      return items.map((i, idx) => ({
        id: i.negocio_id,
        nombre: i.nombre_negocio,
        sucursal: i.sucursal,
        ciudad: i.ciudad,
        categoria: i.categoria,
        subcategoria: i.subcategoria,
        especialidad: i.especialidad,
    
        // Imagen enviada desde el backend
        logo: i.logo_url ?? i.logo ?? null,
    
        abierto: i.abierto ? 'Abierto ahora' : 'Cerrado temporalmente',
        estadoIcono: i.abierto ? 'open' : 'closed',

        // 🔥🔥🔥 HORARIO COMPLETO (AGREGADO SIN CAMBIAR NADA MÁS)
        horario: {
          apertura: i.horario?.apertura ?? null,
          cierre: i.horario?.cierre ?? null,
          mensaje: i.horario?.mensaje ?? null,
        },
    
        promo: i.promo ? `Promoción disponible: ${i.promo.titulo}` : null,
    
        distancia: this.formatDistancia(i.distancia_km),
        mensajeDistancia: this.mensajeDistancia(i.distancia_km),
    
        masCercano: idx === 0,
      }));
    }
    
}
