export class SugerenciasUtil {
  static generar(
    filtros: {
      categoriaId?: number | null;
      subcategoriaId?: number | null;
      categoriaHint?: string;
      subcategoriaHint?: string;
      caracteristica?: string | null;
      caracteristicaAliases?: string[];
    },
    items: any[],
    ciudad: string,
    yaUsadas: string[] = [],
  ): string[] {
    if (!items || items.length === 0) {
      return [
        '¿Quieres intentar con otra búsqueda?',
        '¿Quieres buscar en otra ciudad?',
      ];
    }

    const pool = this.sugerenciasSeguras(ciudad);

    return pool
      .filter((s) => !yaUsadas.includes(s))
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
  }

  private static sugerenciasSeguras(ciudad: string): string[] {
    return [
      '¿Quieres ver el horario de alguno?',
      '¿Quieres ver la ubicación?',
      '¿Quieres ver más detalles de algún lugar?',
      '¿Quieres buscar algo diferente?',
      `¿Quieres buscar otra opción en ${ciudad || 'tu ciudad'}?`,
      '¿Quieres ver cuáles están abiertos ahora?',
      '¿Quieres ver los más cercanos?',
      '¿Quieres ver más resultados?',
      '¿Quieres ordenar por cercanía?',
      '¿Quieres ver opciones con promociones?',
      '¿Quieres ver los mejor calificados?',
      '¿Quieres comparar varias opciones?',
      '¿Quieres ver negocios similares?',
      '¿Quieres ampliar la búsqueda?',
      '¿Quieres buscar en otra colonia?',
      '¿Quieres buscar en otra zona?',
      '¿Quieres ver opciones recomendadas?',
      '¿Quieres ver más información?',
      '¿Quieres conocer los servicios disponibles?',
      '¿Quieres ver lugares cercanos?',
      '¿Quieres explorar más opciones?',
      '¿Quieres ver las opciones más populares?',
      '¿Quieres buscar otra categoría?',
      '¿Quieres ver opciones disponibles hoy?',
      '¿Quieres ver lugares con buena reputación?',
      '¿Quieres seguir explorando resultados?',
      '¿Quieres ver más alternativas?',
      '¿Quieres encontrar algo parecido?',
      '¿Quieres buscar otra necesidad?',
      '¿Quieres ver opciones disponibles cerca de ti?',
      '¿Quieres consultar otra búsqueda?',
      '¿Quieres descubrir nuevos lugares?',
      '¿Quieres ver los resultados destacados?',
      '¿Quieres ver opciones recomendadas para ti?',
      '¿Quieres ver los lugares más visitados?',
      '¿Quieres continuar explorando?',
      '¿Quieres encontrar algo más específico?',
      '¿Quieres ver opciones adicionales?',
      '¿Quieres buscar algo para hoy?',
      '¿Quieres ver lugares abiertos en este momento?',
      '¿Quieres conocer más negocios cercanos?',
      '¿Quieres revisar otras alternativas?',
      '¿Quieres ver opciones disponibles en este momento?',
      '¿Quieres explorar otras recomendaciones?',
      '¿Quieres ver más lugares cercanos?',
      '¿Quieres realizar otra búsqueda?',
      '¿Quieres descubrir nuevas opciones?',
      '¿Quieres ver más detalles?',
      '¿Quieres encontrar otra alternativa?',
      '¿Quieres ver opciones relacionadas?',
      '¿Quieres seguir buscando?',
      '¿Quieres encontrar más resultados?',
    ];
  }
}